"use client"

import type React from "react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, AlertCircle, Play, ChevronDown, ChevronUp, Code, RefreshCw, Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useGeoGebraCommands } from "@/hooks/use-geogebra-commands"
import { Message } from "@/lib/store"

interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
}

interface ChatInterfaceProps {
  messages: any
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  onOpenConfig?: () => void
  error?: string | null
  onExecuteCommands?: (commands: string[]) => void
  onRetry?: (messageId?: string) => void
}

export function ChatInterface({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  onOpenConfig,
  error,
  onExecuteCommands,
  onRetry,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})
  const { extractCommands, extractAllMessagesCommands } = useGeoGebraCommands()

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // 当消息更新时滚动到底部
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // 为每个消息提取GeoGebra命令
  const messageCommandsMap = useMemo(() => {
    return extractAllMessagesCommands(messages)
  }, [messages, extractAllMessagesCommands])

  // 切换消息命令的展开/折叠状态
  const toggleMessageExpanded = useCallback((messageId: string) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }, [])

  // 执行特定消息的命令
  const executeMessageCommands = useCallback(
    (messageId: string) => {
      const commands = messageCommandsMap[messageId] || []
      if (commands.length > 0 && onExecuteCommands) {
        onExecuteCommands(commands)
      }
    },
    [messageCommandsMap, onExecuteCommands],
  )

  return (
    <Card className="flex-1 flex flex-col overflow-hidden border-0 rounded-none">
      <CardHeader className="border-b p-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">对话</CardTitle>
          <div className="flex gap-2"></div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 relative overflow-hidden">
        <div className="chat-messages-container absolute inset-0 p-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-8">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">开始一个对话</h3>
                <p className="text-muted-foreground">提出问题或开始新话题以开始聊天。</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2 pb-1">
              {messages.map((message: any) => {
                const messageId = message.id || `msg-${message.content.substring(0, 10)}`
                const commands = messageCommandsMap[messageId] || []
                const hasCommands = commands.length > 0

                return (
                  <div key={messageId} className="mb-3">
                    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "assistant" && (
                        <div className="flex flex-col items-start gap-1 mr-1">
                          {hasCommands && (
                        <Button
                          variant="ghost"
                          size="icon"
                              className="h-8 w-8 flex-shrink-0"
                          onClick={() => executeMessageCommands(messageId)}
                          title="执行此消息中的所有GeoGebra命令"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                          )}
                          {!isLoading && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => {
                                // 找到当前消息之前的最后一条用户消息
                                const currentIndex = messages.findIndex((msg: Message) => msg.id === messageId)
                                if (currentIndex > 0) {
                                  const previousUserMessage = [...messages]
                                    .slice(0, currentIndex)
                                    .reverse()
                                    .find((msg: Message) => msg.role === "user")
                                  if (previousUserMessage) {
                                    // 获取从开始到当前消息之前的所有消息作为上下文
                                    const contextMessages = messages.slice(0, currentIndex)
                                    // 设置输入框内容为要重试的消息
                                    handleInputChange({ target: { value: previousUserMessage.content } } as any)
                                    // 重新发送消息，保留上下文
                                    handleSubmit(new Event("submit") as any)
                                  }
                                }
                              }}
                              title="重试此消息"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                      <div
                        className={`max-w-[90%] rounded-lg px-3 py-1.5 ${
                          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        <div className="markdown-content whitespace-pre-wrap break-words">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline"
                                />
                              ),
                              code: ({ node, className, children, ...props }) => {
                                return (
                                  <div className="bg-gray-100 dark:bg-gray-900 rounded-md my-1 overflow-x-auto">
                                    <code className="block p-2 text-sm text-blue-50" {...props}>
                                      {children}
                                    </code>
                                  </div>
                                )
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>

                    {/* 在助手消息下方显示GeoGebra命令 */}
                    {message.role === "assistant" && hasCommands && (
                      <div className="ml-4 mt-1 mb-2 w-[90%]">
                        <Collapsible
                          open={expandedMessages[messageId] || false}
                          onOpenChange={() => toggleMessageExpanded(messageId)}
                          className="w-full"
                        >
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="flex items-center gap-1 h-6 px-2 text-xs">
                              <Code className="h-3 w-3" />
                              GeoGebra命令 ({commands.length})
                              {expandedMessages[messageId] ? (
                                <ChevronUp className="h-3 w-3 ml-1" />
                              ) : (
                                <ChevronDown className="h-3 w-3 ml-1" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1 h-6 px-2 text-xs ml-2"
                            onClick={() => executeMessageCommands(messageId)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            执行全部
                          </Button>
                          <CollapsibleContent>
                            <div className="mt-1 space-y-1 border rounded-md p-2 bg-background">
                              {commands.map((cmd, i) => (
                                <div
                                  key={i}
                                  className="text-xs p-1.5 bg-muted rounded-md flex justify-between items-center"
                                >
                                  <code className="text-xs">{cmd}</code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 ml-2"
                                    onClick={() => onExecuteCommands?.([cmd])}
                                    title="在GeoGebra中执行"
                                  >
                                    <span className="sr-only">执行</span>▶
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )}
                  </div>
                )
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">正在思考...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t p-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            placeholder="输入您的消息..."
            value={input}
            onChange={handleInputChange}
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}

