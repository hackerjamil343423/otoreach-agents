export type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: string; mimeType?: string }
      | { type: 'document'; name: string; content: string; mimeType: string }
    >

export interface ChatMessage {
  id: string
  createdAt: string
  content: MessageContent
  role: ChatRole
}

export interface Persona {
  id?: string
  role: ChatRole
  name?: string
  prompt?: string
  webhookUrl?: string | null
  isDefault?: boolean
}

export interface Chat {
  id: string
  sessionId?: string
  createdAt: string
  updatedAt: string
  title: string
  persona?: Persona
}

export type ChatRole = 'assistant' | 'user' | 'system'
