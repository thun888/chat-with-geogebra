import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

// 类型定义
export type ApiConfig = {
  domain: string
  path: string
  key: string
}

export type ModelConfig = {
  name: string
  provider: string
  modelType: string
  customModelType?: string
  apiConfig: ApiConfig
}

export type ConfigSettings = {
  modelType: string
  systemPrompt: string
  customModels: ModelConfig[]
}

export type Conversation = {
  id: string
  title: string
}

export type Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: number
}

// 默认配置
const DEFAULT_CONFIG: ConfigSettings = {
  modelType: "gpt-4o",
  systemPrompt: `你是一个几何学助手，可以通过GeoGebra绘制几何图形和动画。

当用户请求绘制图形或动画时，请提供：
1. 友好的解释，包括数学概念和原理
2. 清晰的GeoGebra命令

规范：
1. 将GeoGebra命令放在\`\`\`geogebra和\`\`\`标记之间，每行一个命令。
2. 不要在GeoGebra代码块中添加注释。
3. 命令应该按照逻辑顺序排列，从基本元素到复杂构造。
4. 数学公式应该包裹在$$中

GeoGebra支持的命令类型包括：

## 基本元素
- 点：A = (2, 3)
- 向量：v = Vector[A, B] 或 v = (1, 2)
- 线段：Segment(A, B)
- 直线：Line(A, B)
- 射线：Ray(A, B)
- 圆：Circle(A, 3) 或 Circle(A, B)
- 椭圆：Ellipse(F1, F2, a)
- 多边形：Polygon(A, B, C, …)
- 正多边形：RegularPolygon(A, B, n)

## 函数和曲线
- 斜率：Slope(line)

## 动画和交互
- 滑块：a = Slider[0, 10, 0.1]
- 启动/停止动画：StartAnimation[a, true] 或 StartAnimation[a, false]
- 设置动画速度：SetAnimationSpeed(object, speed)
- 条件显示对象：SetConditionToShowObject(object, condition)
- 设置轨迹：SetTrace(object, true) 或 SetTrace(object, false)
- 轨迹曲线：Locus(point, parameter)

## 高级功能
- 序列：Sequence(expression, variable, from, to, step)
- 列表：{a, b, c}
- 条件表达式：If(condition, then, else)
- 文本对象：Text("文本", (x, y))
- 脚本按钮（示意）：点击脚本中使用 RunClickScript("命令")

## 动画示例

### 1. 创建滑块并用于动画：
  a = Slider[0, 10, 0.1]
  P = (a, 0)
  StartAnimation[a, true]

### 2. 圆上运动的点：
  a = Slider[0, 2π, 0.01]
  P = (5 cos(a), 5 sin(a))
  Circle((0, 0), 5)
  StartAnimation[a, true]

### 3. 函数图像的动态变化：
  a = Slider[0, 5, 0.1]
  f(x) = a x^2
  StartAnimation[a, true]

请确保命令语法正确，并在解释中提及每个命令的目的。
如果用户的请求不明确，请提出澄清问题。
用户的请求可能与之前提出的请求相关。`,
  customModels: [],
}

// 默认对话
const DEFAULT_CONVERSATION: Conversation = {
  id: "default",
  title: "新对话",
}

// Store类型
interface AppState {
  // 配置状态
  config: ConfigSettings
  updateConfig: (config: Partial<ConfigSettings>) => void

  // 对话状态
  conversations: Conversation[]
  activeConversationId: string
  messages: Record<string, Message[]>

  // 对话操作
  setActiveConversation: (id: string) => void
  createConversation: () => string
  deleteConversation: (id: string) => void
  updateConversationTitle: (id: string, title: string) => void

  // 消息操作
  addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  clearMessages: (conversationId: string) => void

  // UI状态
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  showGeogebra: boolean
  setShowGeogebra: (show: boolean) => void
}

// 创建store - 使用普通方式而不是immer中间件
export const useAppStore = create<AppState>()(
  persist<AppState>(
    (set, get) => ({
      // 配置状态
      config: DEFAULT_CONFIG,
      updateConfig: (newConfig: Partial<ConfigSettings>) =>
        set((state: AppState) => ({
          config: { ...state.config, ...newConfig },
        })),

      // 对话状态
      conversations: [DEFAULT_CONVERSATION],
      activeConversationId: DEFAULT_CONVERSATION.id,
      messages: {},

      // 对话操作
      setActiveConversation: (id: string) => set({ activeConversationId: id }),
      createConversation: () => {
        const id = `conv-${Date.now()}`
        const newConversation: Conversation = { id, title: "新会话" }

        set((state: AppState) => {
          // 检查是否已经存在相同ID的对话，防止重复创建
          const existingConversation = state.conversations.find((c) => c.id === id)
          if (existingConversation) {
            return { activeConversationId: id }
          }

          return {
            conversations: [...state.conversations, newConversation],
            activeConversationId: id,
            // 确保新对话的消息列表为空
            messages: {
              ...state.messages,
              [id]: [],
            },
          }
        })

        return id
      },
      deleteConversation: (id: string) =>
        set((state: AppState) => {
          // 如果要删除的是当前活动对话，则切换到另一个对话
          let newActiveId = state.activeConversationId
          if (state.activeConversationId === id && state.conversations.length > 1) {
            const nextConv = state.conversations.find((c) => c.id !== id)
            if (nextConv) {
              newActiveId = nextConv.id
            }
          }

          // 删除对话
          const newConversations = state.conversations.filter((c) => c.id !== id)

          // 删除对话消息
          const newMessages = { ...state.messages }
          delete newMessages[id]

          // 如果没有对话，创建一个新的
          if (newConversations.length === 0) {
            const newId = `conv-${Date.now()}`
            const newConversation: Conversation = { id: newId, title: "新会话" }
            return {
              conversations: [newConversation],
              activeConversationId: newId,
              messages: newMessages,
            }
          }

          return {
            conversations: newConversations,
            activeConversationId: newActiveId,
            messages: newMessages,
          }
        }),
      updateConversationTitle: (id: string, title: string) =>
        set((state: AppState) => ({
          conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
        })),

      // 消息操作
      addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) =>
        set((state: AppState) => {
          const conversationMessages = state.messages[conversationId] || []

          const newMessage: Message = {
            ...message,
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            createdAt: Date.now(),
          }

          const newMessages = {
            ...state.messages,
            [conversationId]: [...conversationMessages, newMessage],
          }

          // 如果是第一条用户消息，更新对话标题
          let newConversations = [...state.conversations]
          if (message.role === "user" && conversationMessages.length === 0) {
            const title = message.content.slice(0, 20) + (message.content.length > 20 ? "..." : "")
            newConversations = state.conversations.map((c) => (c.id === conversationId ? { ...c, title } : c))
          }

          return {
            messages: newMessages,
            conversations: newConversations,
          }
        }),
      setMessages: (conversationId: string, messages: Message[]) =>
        set((state: AppState) => ({
          messages: {
            ...state.messages,
            [conversationId]: messages,
          },
        })),
      clearMessages: (conversationId: string) =>
        set((state: AppState) => ({
          messages: {
            ...state.messages,
            [conversationId]: [],
          },
        })),

      // UI状态
      sidebarOpen: true,
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      showGeogebra: true,
      setShowGeogebra: (show: boolean) => set({ showGeogebra: show }),
    }),
    {
      name: "llm-chat-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state: AppState) => ({
        ...state,
        config: state.config,
        conversations: state.conversations,
        messages: state.messages,
        activeConversationId: state.activeConversationId,
        sidebarOpen: state.sidebarOpen,
        showGeogebra: state.showGeogebra,
      }),
    },
  ),
)

// 辅助函数，用于从useChat钩子的消息格式转换到我们的消息格式
export function convertChatMessagesToStore(messages: any[]): Message[] {
  return messages.map((msg: any, index: number) => ({
    id: msg.id || `imported-${index}`,
    role: msg.role,
    content: msg.content,
    createdAt: Date.now() - (messages.length - index) * 1000, // 简单模拟创建时间
  }))
}

// 辅助函数，用于从我们的消息格式转换到useChat钩子的消息格式
export function convertStoreMessagesToChat(messages: Message[]): any[] {
  return messages.map((msg: Message) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
  }))
}

