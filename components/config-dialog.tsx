"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppStore } from "@/lib/store"

export type ApiConfig = {
  domain: string
  path: string
  key: string
}

export type ModelConfig = {
  name: string
  provider: string
  modelType: string
  apiConfig: ApiConfig
}

export type ConfigSettings = {
  modelType: string
  systemPrompt: string
  customModels: ModelConfig[]
}

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
}

const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { value: "gpt-4", label: "GPT-4", provider: "openai" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", provider: "openai" },
  { value: "claude-3-opus", label: "Claude 3 Opus", provider: "anthropic" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet", provider: "anthropic" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku", provider: "anthropic" },
  { value: "deepseek-chat", label: "DeepSeek Chat", provider: "deepseek" },
  { value: "deepseek-coder", label: "DeepSeek Coder", provider: "deepseek" },
  { value: "llama-3", label: "Llama 3", provider: "openai" },
]

export function ConfigDialog({ open, onOpenChange, onSave }: ConfigDialogProps) {
  // 从store获取配置
  const config = useAppStore((state) => state.config)
  const updateConfig = useAppStore((state) => state.updateConfig)

  // 本地状态用于表单
  const [localConfig, setLocalConfig] = useState<ConfigSettings>(config)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("model")
  const [showModelForm, setShowModelForm] = useState(false)
  const [newModel, setNewModel] = useState<ModelConfig>({
    name: "",
    provider: "openai",
    modelType: "",
    apiConfig: {
      domain: "https://api.openai.com",
      path: "/v1/chat/completions",
      key: ""
    }
  })

  // 提供商预设配置
  const providerPresets = {
    openai: {
      domain: "https://api.openai.com",
      path: "/v1/chat/completions"
    },
    anthropic: {
      domain: "https://api.anthropic.com",
      path: "/v1/messages"
    },
    deepseek: {
      domain: "https://api.deepseek.com",
      path: "/v1/chat/completions"
    },
    openrouter: {
      domain: "https://openrouter.ai",
      path: "/api/v1/chat/completions"
    }
  }

  // 处理提供商变更
  const handleProviderChange = (value: string) => {
    setNewModel({
      ...newModel,
      provider: value,
      apiConfig: {
        ...newModel.apiConfig,
        domain: providerPresets[value as keyof typeof providerPresets].domain,
        path: providerPresets[value as keyof typeof providerPresets].path,
        key: ""
      }
    })
  }

  // 当对话框打开或配置更改时，更新本地状态
  useEffect(() => {
    setLocalConfig(config)
  }, [config, open])

  const handleSave = () => {
    console.debug("配置保存:", localConfig)

    // 获取当前选择的模型的提供商
    const selectedModel = MODEL_OPTIONS.find((model) => model.value === localConfig.modelType)
    const provider = selectedModel?.provider || "openai"

    console.debug("当前模型提供商:", { provider, modelType: localConfig.modelType })

    // 检查是否是自定义模型
    const customModel = localConfig.customModels.find(
      (model) => model.name === localConfig.modelType
    )

    // 检查API密钥是否存在
    if (customModel && !customModel.apiConfig.key) {
      console.debug("API密钥验证失败:", { model: customModel.name, hasKey: false })
      setError(`${customModel.provider} API Key 是必填项`)
      setActiveTab("model")
      return
    }

    console.debug("API密钥验证通过:", {
      model: customModel?.name || localConfig.modelType,
      hasKey: true,
    })

    // 更新store中的配置
    updateConfig(localConfig)

    // 显示保存成功提示
    setSaveSuccess(true)

    // 调用可选的onSave回调
    if (onSave) onSave()

    // 2秒后关闭对话框
    setTimeout(() => {
      setSaveSuccess(false)
      onOpenChange(false)
    }, 2000)

    setError(null)
  }

  const getCurrentProviderKey = () => {
    const selectedModel = MODEL_OPTIONS.find((model) => model.value === localConfig.modelType)
    return selectedModel?.provider || "openai"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>LLM 配置</DialogTitle>
          <DialogDescription>配置聊天应用的语言模型、API密钥和系统提示词。</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="model">模型</TabsTrigger>
            <TabsTrigger value="prompt">系统提示词</TabsTrigger>
          </TabsList>

          <TabsContent value="model" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">模型</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModelForm(!showModelForm)}
                >
                  {showModelForm ? "取消" : "添加模型"}
                </Button>
              </div>

              {showModelForm && (
                <div className="space-y-4 p-4 border rounded-md">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="modelType" className="text-right">
                      模型类型
                    </Label>
                    <div className="col-span-3">
                      <Select
                        value={newModel.modelType}
                        onValueChange={(value) => {
                          if (value === "custom") {
                            setNewModel({ ...newModel, modelType: "", name: "" })
                          } else {
                            setNewModel({ ...newModel, modelType: value, name: value })
                          }
                        }}
                      >
                        <SelectTrigger id="modelType">
                          <SelectValue placeholder="选择模型类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                          <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                          <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                          <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                          <SelectItem value="deepseek-coder">DeepSeek Coder</SelectItem>
                          <SelectItem value="custom">自定义</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {newModel.modelType === "" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="modelName" className="text-right">
                        模型名称
                      </Label>
                      <div className="col-span-3">
                        <Input
                          id="modelName"
                          value={newModel.name}
                          onChange={(e) =>
                            setNewModel({ ...newModel, name: e.target.value })
                          }
                          placeholder="输入自定义模型名称"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="modelProvider" className="text-right">
                      提供商
                    </Label>
                    <div className="col-span-3">
                      <Select
                        value={newModel.provider}
                        onValueChange={handleProviderChange}
                      >
                        <SelectTrigger id="modelProvider">
                          <SelectValue placeholder="选择提供商" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI兼容</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="deepseek">DeepSeek</SelectItem>
                          <SelectItem value="openrouter">OpenRouter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="modelDomain" className="text-right">
                      API域名
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="modelDomain"
                        value={newModel.apiConfig.domain}
                        onChange={(e) =>
                          setNewModel({
                            ...newModel,
                            apiConfig: { ...newModel.apiConfig, domain: e.target.value },
                          })
                        }
                        placeholder="输入API域名"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="modelPath" className="text-right">
                      API路径
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="modelPath"
                        value={newModel.apiConfig.path}
                        onChange={(e) =>
                          setNewModel({
                            ...newModel,
                            apiConfig: { ...newModel.apiConfig, path: e.target.value },
                          })
                        }
                        placeholder="输入API路径"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="modelKey" className="text-right">
                      API密钥
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="modelKey"
                        type="password"
                        value={newModel.apiConfig.key}
                        onChange={(e) =>
                          setNewModel({
                            ...newModel,
                            apiConfig: { ...newModel.apiConfig, key: e.target.value },
                          })
                        }
                        placeholder="输入API密钥"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        setLocalConfig({
                          ...localConfig,
                          customModels: [...localConfig.customModels, newModel],
                        })
                        setNewModel({
                          name: "",
                          provider: "openai",
                          modelType: "",
                          apiConfig: {
                            domain: "https://api.openai.com",
                            path: "/v1/chat/completions",
                            key: "",
                          },
                        })
                        setShowModelForm(false)
                      }}
                    >
                      添加
                    </Button>
                  </div>
                </div>
              )}

              {localConfig.customModels.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">已添加的模型</h4>
                  <div className="space-y-2">
                    {localConfig.customModels.map((model, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2 border rounded-md ${
                          localConfig.modelType === model.name ? "bg-green-50 border-green-200" : ""
                        }`}
                      >
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {model.provider} - {model.modelType} - {model.apiConfig.domain}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {localConfig.modelType === model.name ? (
                            <Button variant="outline" size="sm" className="bg-green-100 text-green-800 hover:bg-green-200">
                              当前使用
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLocalConfig({
                                  ...localConfig,
                                  modelType: model.name,
                                });
                              }}
                            >
                              选择使用
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewModel({ ...model });
                              setShowModelForm(true);
                              setLocalConfig({
                                ...localConfig,
                                customModels: localConfig.customModels.filter(
                                  (_, i) => i !== index
                                ),
                              });
                            }}
                          >
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // 如果删除的是当前选中的模型，则将模型类型设置为默认的GPT-4o
                              if (localConfig.modelType === model.name) {
                                setLocalConfig({
                                  ...localConfig,
                                  modelType: "gpt-4o",
                                  customModels: localConfig.customModels.filter(
                                    (_, i) => i !== index
                                  ),
                                });
                              } else {
                                setLocalConfig({
                                  ...localConfig,
                                  customModels: localConfig.customModels.filter(
                                    (_, i) => i !== index
                                  ),
                                });
                              }
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="systemPrompt" className="text-right pt-2">
                系统提示词
              </Label>
              <div className="col-span-3">
                <Textarea
                  id="systemPrompt"
                  value={localConfig.systemPrompt}
                  onChange={(e) => setLocalConfig({ ...localConfig, systemPrompt: e.target.value })}
                  placeholder="输入系统提示词，定义AI助手的行为和知识范围"
                  className="min-h-[150px]"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {saveSuccess && <div className="p-2 bg-green-100 text-green-800 rounded-md text-center">设置已成功保存</div>}
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

