import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { streamText } from "ai"
import { logger } from "@/lib/logger"
import type { ConfigSettings } from "@/lib/store"
import { GeoGebraValidator } from "@/utils/geogebra-validator"

// 在函数开头添加调试日志
export async function POST(req: Request) {
  try {
    logger.api("收到聊天请求")
    const { messages, configSettings } = await req.json()
    logger.api("请求数据", {
      messageCount: messages.length,
      modelType: configSettings?.modelType,
      systemPromptLength: configSettings?.systemPrompt?.length,
    })

    // Default to OpenAI GPT-4o if no config is provided
    const modelType = configSettings?.modelType || "gpt-4o"
    const systemPrompt =
      configSettings?.systemPrompt ||
      "你是一个专注于数学和GeoGebra的助手。帮助用户理解数学概念并使用GeoGebra进行可视化。请确保只使用有效的GeoGebra命令。"

    // 检查是否是自定义模型
    const customModel = configSettings?.customModels?.find(
      (model: { name: string }) => model.name === modelType
    )

    // 获取对应模型的API配置
    let apiConfig
    if (customModel) {
      // 使用自定义模型的配置
      apiConfig = {
        domain: customModel.apiConfig?.domain || "https://api.openai.com",
        path: customModel.apiConfig?.path || "/v1/chat/completions",
        key: customModel.apiConfig.key || ""
      }
      
      // 检查API密钥是否是占位符，如果是，则使用环境变量中的密钥
      if (apiConfig.key === "OPENROUTER_API_KEY_PLACEHOLDER") {
        apiConfig.key = process.env.OPENROUTER_API_KEY || "";
        logger.api("使用环境变量中的OpenRouter API密钥");
        
        // 检查环境变量是否已设置
        if (!process.env.OPENROUTER_API_KEY) {
          logger.error("错误 - 未设置OPENROUTER_API_KEY环境变量");
          return new Response(JSON.stringify({ 
            error: "未设置OPENROUTER_API_KEY环境变量。请在Vercel项目设置中添加此环境变量，或在设置页面配置自定义API密钥。" 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      
      logger.api("使用自定义模型配置", {
        model: customModel.name,
        provider: customModel.provider,
        domain: apiConfig.domain,
      })
    } else {
      // 内置提供商的预设配置
      const builtInConfigs = {
        "gpt-4o": {
          domain: "https://api.openai.com",
          path: "/v1/chat/completions",
          key: process.env.OPENAI_API_KEY || ""
        },
        "claude-3-opus": {
          domain: "https://api.anthropic.com",
          path: "/v1/messages",
          key: process.env.ANTHROPIC_API_KEY || ""
        },
        "deepseek-chat": {
          domain: "https://api.deepseek.com",
          path: "/v1/chat/completions",
          key: process.env.DEEPSEEK_API_KEY || ""
        }
      }

      apiConfig = builtInConfigs[modelType as keyof typeof builtInConfigs] || builtInConfigs["gpt-4o"]
      logger.api("使用内置模型配置", {
        model: modelType,
        domain: apiConfig.domain,
      })
    }

    if (!apiConfig.key) {
      logger.error("错误 - 缺少API密钥")
      return new Response(JSON.stringify({ 
        error: modelType === "deepseek-free" 
          ? "缺少OpenRouter API密钥。请在Vercel项目设置中添加OPENROUTER_API_KEY环境变量，或在设置页面配置自定义API密钥。"
          : "需要API密钥，请在设置中配置对应模型的API密钥" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Select the appropriate model based on the configuration
    let model, the_model

    try {
      if (customModel) {
        // 使用自定义模型配置
        if (customModel.provider === "anthropic") {
          the_model = createAnthropic({
            apiKey: apiConfig.key,
            baseURL: apiConfig.domain,
          })
        } else if (customModel.provider === "deepseek") {
          the_model = createDeepSeek({
            apiKey: apiConfig.key,
            baseURL: apiConfig.domain,
          })
        } else {
          the_model = createOpenAI({
            apiKey: apiConfig.key,
            baseURL: apiConfig.domain,
          })
        }
      } else if (modelType.startsWith("claude")) {
        // For Claude models
        logger.api("初始化Claude模型", { model: modelType })
        the_model = createAnthropic({
          apiKey: apiConfig.key,
          baseURL: apiConfig.domain,
        })
      } else if (modelType.startsWith("deepseek")) {
        // For DeepSeek models
        const deepseekModel = modelType === "deepseek-chat" ? "deepseek-chat" : "deepseek-coder"
        logger.api("初始化DeepSeek模型", { model: deepseekModel })
        the_model = createDeepSeek({
          apiKey: apiConfig.key,
          baseURL: apiConfig.domain,
        })
      } else {
        // For OpenAI models (default)
        logger.api("初始化OpenAI模型", { model: modelType })
        the_model = createOpenAI({
          apiKey: apiConfig.key,
          baseURL: apiConfig.domain,
        })
      }
    } catch (error) {
      logger.error("初始化模型错误:", error)
      return new Response(JSON.stringify({ error: "初始化模型失败，请检查API密钥和模型配置" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    model = the_model(modelType)

    logger.api("创建流式响应")
    // Create a stream using the AI SDK
    try {
      const result = streamText({
        model,
        system: systemPrompt,
        messages,
      })

      // 创建一个转换流来验证命令
      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          
          // 提取并验证GeoGebra命令
          const commands = GeoGebraValidator.extractCommands(text)
          if (commands.length > 0) {
            const validation = GeoGebraValidator.validateCommands(commands)
            if (!validation.isValid) {
              // 如果发现无效命令，添加警告信息
              const warning = `\n\n⚠️ 警告：发现以下无效的GeoGebra命令：\n${validation.errors.join('\n')}\n请检查命令是否正确。`
              controller.enqueue(new TextEncoder().encode(warning))
            }
          }
          
          controller.enqueue(chunk)
        }
      })

      logger.api("返回流式响应")
      // 返回流式响应
      const response = result.toDataStreamResponse({
        headers: {
          "Transfer-Encoding": "chunked",
          Connection: "keep-alive"
        }
      })

      // 使用转换流处理响应体
      const transformedBody = response.body?.pipeThrough(transformStream)
      return new Response(transformedBody, {
        headers: response.headers
      })
    } catch (error) {
      logger.error("创建流式响应错误:", error)
      return new Response(JSON.stringify({ error: "创建聊天流失败，请检查网络连接" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    logger.error("处理请求错误:", error)
    return new Response(JSON.stringify({ error: "处理请求时发生错误" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

