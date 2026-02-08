'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ensureMessageIds } from '@/components/chat/utils'
import { v4 as uuid } from 'uuid'

import { ChatRef } from './chat'
import type { ChatContextValue } from './chatContext'
import { Chat, ChatMessage, MessageContent, Persona } from './interface'

const DefaultPersona: Persona = {
  id: 'default',
  role: 'assistant',
  name: 'ChatGPT',
  prompt: 'You are a helpful AI assistant.',
  isDefault: true
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token')
  const user = localStorage.getItem('user')

  const headers: Record<string, string> = {}

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else if (user) {
    try {
      const userData = JSON.parse(user)
      headers['x-user-email'] = userData.email || ''
    } catch {
      // Invalid user data
    }
  }

  return headers
}

const truncateToWords = (text: string, maxWords: number) => {
  const words = text.split(/\s+/).slice(0, maxWords)
  return words.join(' ')
}

const stripHtmlTags = (text: string) => text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')

const getTextFromContent = (content: MessageContent): string => {
  if (typeof content === 'string') {
    return content
  }
  return content
    .filter((part) => part.type === 'text' || part.type === 'document')
    .map((part) => {
      if (part.type === 'text') {
        return part.text
      } else if (part.type === 'document') {
        return `[${part.name}]`
      }
      return ''
    })
    .join(' ')
}

const deriveTitleFromMessages = (messages: ChatMessage[], fallback: string) => {
  const userMessage = messages.find((msg) => msg.role === 'user')
  const userContent = userMessage ? getTextFromContent(userMessage.content).trim() : ''
  const firstContent = messages[0] ? getTextFromContent(messages[0].content).trim() : ''
  const candidate = stripHtmlTags(userContent || firstContent || '')
  if (!candidate) {
    return fallback
  }
  return truncateToWords(candidate, 4)
}

const loadInitialChatData = () => ({
  chatList: [],
  currentChatId: undefined,
  messagesById: new Map<string, ChatMessage[]>()
})

type SyncOptions = { refreshConversation?: boolean }

const useChatHook = (): ChatContextValue => {
  const messagesMapRef = useRef<Map<string, ChatMessage[]>>(new Map<string, ChatMessage[]>())
  const chatInstanceRef = useRef<ChatRef | null>(null)
  const chatListRef = useRef<Chat[]>([])
  const currentChatIdRef = useRef<string | undefined>(undefined)
  const hasLoadedRef = useRef(false)
  const [initialData] = useState(loadInitialChatData)

  const [currentChatId, setCurrentChatId] = useState<string | undefined>(initialData.currentChatId)
  const [chatList, setChatList] = useState<Chat[]>(initialData.chatList)
  const [isChatHydrated, setIsChatHydrated] = useState(false)

  const currentChat = useMemo(
    () => chatList.find((chat) => chat.id === currentChatId),
    [chatList, currentChatId]
  )

  // Fetch chats from database
  const fetchChatsFromDB = useCallback(async () => {
    try {
      const response = await fetch('/api/user/chats', {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        return data.chats || []
      }
    } catch (error) {
      console.error('Failed to fetch chats from database:', error)
    }
    return []
  }, [])

  // Fetch messages for a chat from database
  const fetchMessagesFromDB = useCallback(async (chatId: string): Promise<ChatMessage[]> => {
    try {
      const response = await fetch(`/api/user/chats/${chatId}/messages`, {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        return ensureMessageIds(data.messages || [])
      }
    } catch (error) {
      console.error('Failed to fetch messages from database:', error)
    }
    return []
  }, [])

  // Create a new chat in the database
  const createChatInDB = useCallback(
    async (title: string, persona?: Persona): Promise<Chat | null> => {
      try {
        const response = await fetch('/api/user/chats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ title })
        })

        if (response.ok) {
          const data = await response.json()
          return {
            id: data.chat.id,
            sessionId: data.chat.session_id,
            title: data.chat.title,
            createdAt: data.chat.created_at,
            updatedAt: data.chat.updated_at,
            persona
          }
        }
      } catch (error) {
        console.error('Failed to create chat in database:', error)
      }
      return null
    },
    []
  )

  // Delete a chat from the database
  const deleteChatFromDB = useCallback(async (chatId: string) => {
    try {
      const response = await fetch(`/api/user/chats/${chatId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      return response.ok
    } catch (error) {
      console.error('Failed to delete chat from database:', error)
      return false
    }
  }, [])

  // Update chat title in database
  const updateChatTitleInDB = useCallback(async (chatId: string, title: string) => {
    try {
      const response = await fetch(`/api/user/chats/${chatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ title })
      })
      return response.ok
    } catch (error) {
      console.error('Failed to update chat title:', error)
      return false
    }
  }, [])

  const applyState = useCallback(
    (nextList: Chat[], requestedCurrentId?: string, options?: SyncOptions) => {
      const sorted = [...nextList].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      const requestedId = requestedCurrentId ?? currentChatIdRef.current
      const resolvedCurrentId = sorted.find((chat) => chat.id === requestedId)
        ? requestedId
        : sorted[0]?.id

      chatListRef.current = sorted
      currentChatIdRef.current = resolvedCurrentId
      setChatList(sorted)
      setCurrentChatId(resolvedCurrentId)

      // Clean up messages for deleted chats
      const validIds = new Set(sorted.map((chat) => chat.id))
      messagesMapRef.current.forEach((_, key) => {
        if (!validIds.has(key)) {
          messagesMapRef.current.delete(key)
        }
      })

      if (options?.refreshConversation !== false) {
        const nextMessages = resolvedCurrentId
          ? messagesMapRef.current.get(resolvedCurrentId) || []
          : []
        chatInstanceRef.current?.setConversation(nextMessages, resolvedCurrentId ?? null)
        chatInstanceRef.current?.focus()
      }
    },
    []
  )

  const getChatById = useCallback((id?: string | null) => {
    const targetId = id ?? currentChatIdRef.current
    if (!targetId) {
      return undefined
    }
    return chatListRef.current.find((chat) => chat.id === targetId)
  }, [])

  const updateChatTitle = useCallback(
    async (chatId: string, title: string) => {
      const nextList = chatListRef.current.map((chat) =>
        chat.id === chatId ? { ...chat, title: title || chat.title } : chat
      )
      chatListRef.current = nextList
      await updateChatTitleInDB(chatId, title)
      applyState(nextList, currentChatIdRef.current, { refreshConversation: false })
    },
    [applyState, updateChatTitleInDB]
  )

  const saveMessages = useCallback(
    async (messages: ChatMessage[], chatId?: string) => {
      const targetChatId = chatId ?? currentChatIdRef.current
      if (!targetChatId) {
        return
      }

      messagesMapRef.current.set(targetChatId, messages)

      const chat = chatListRef.current.find((item) => item.id === targetChatId)
      if (!chat) {
        return
      }

      const previousCount =
        messages.length === 0 ? 0 : (messagesMapRef.current.get(targetChatId)?.length ?? 0)

      // Only update title if this is the first user message
      if (previousCount === 0 && messages.length > 0) {
        const newTitle = deriveTitleFromMessages(messages, chat.title)
        if (newTitle !== chat.title) {
          await updateChatTitleInDB(targetChatId, newTitle)
          chatListRef.current = chatListRef.current.map((item) =>
            item.id === targetChatId ? { ...item, title: newTitle } : item
          )
        }
      }
    },
    [updateChatTitleInDB]
  )

  const activateChat = useCallback(
    async (chat: Chat) => {
      void currentChatIdRef.current

      // Fetch messages from database
      const messages = await fetchMessagesFromDB(chat.id)
      messagesMapRef.current.set(chat.id, messages)

      const baseList = chatListRef.current
      const exists = baseList.some((item) => item.id === chat.id)
      const updatedList = exists ? baseList : [chat, ...baseList]
      applyState(updatedList, chat.id)

      // Set the conversation in the chat component
      chatInstanceRef.current?.setConversation(messages, chat.id)
      chatInstanceRef.current?.focus()
    },
    [applyState, fetchMessagesFromDB]
  )

  const onChangeChat = useCallback(
    (chat: Chat) => {
      activateChat(chat)
    },
    [activateChat]
  )

  const onCreateChat = useCallback(
    async (persona: Persona, firstMessage?: string) => {
      const quickTitle = firstMessage
        ? truncateToWords(firstMessage, 4)
        : persona.name || 'New Chat'

      // Create chat in database
      const newChat = await createChatInDB(quickTitle, persona)

      if (newChat) {
        activateChat(newChat)
        return newChat
      }

      // Fallback if DB creation fails
      const id = uuid()
      const sessionId = uuid()
      const now = new Date().toISOString()
      const newChatObj: Chat = {
        id,
        sessionId,
        persona,
        title: quickTitle,
        createdAt: now,
        updatedAt: now
      }
      activateChat(newChatObj)
      return newChatObj
    },
    [activateChat, createChatInDB]
  )

  const onCreateDefaultChat = useCallback(
    (firstMessage?: string) => {
      return onCreateChat(DefaultPersona, firstMessage)
    },
    [onCreateChat]
  )

  const onDeleteChat = useCallback(
    async (chat: Chat) => {
      // Delete from database
      await deleteChatFromDB(chat.id)

      // Update local state
      const filteredList = chatListRef.current.filter((item) => item.id !== chat.id)
      messagesMapRef.current.delete(chat.id)

      const hasChatsLeft = filteredList.length > 0
      const nextList = hasChatsLeft ? filteredList : []

      const nextChatId =
        currentChatId === chat.id || currentChatIdRef.current === chat.id || !hasChatsLeft
          ? nextList[0]?.id
          : currentChatIdRef.current

      applyState(nextList, nextChatId)

      // If no chats left, create a new one
      if (!hasChatsLeft) {
        onCreateDefaultChat()
      }
    },
    [applyState, deleteChatFromDB, currentChatId, onCreateDefaultChat]
  )

  // Initial load from database
  useEffect(() => {
    if (hasLoadedRef.current) {
      return
    }
    hasLoadedRef.current = true

    const loadChats = async () => {
      const dbChats = await fetchChatsFromDB()

      if (dbChats.length === 0) {
        // Create a default chat
        const newChat = await createChatInDB('New Chat', DefaultPersona)
        if (newChat) {
          applyState([newChat], newChat.id, { refreshConversation: false })
        }
      } else {
        const chatsWithPersona = dbChats.map(
          (chat: {
            id: string
            session_id: string
            title: string
            created_at: string
            updated_at: string
            persona_id?: string
            persona_name?: string
          }) => ({
            id: chat.id,
            sessionId: chat.session_id,
            title: chat.title,
            createdAt: chat.created_at,
            updatedAt: chat.updated_at,
            persona: chat.persona_id
              ? {
                  id: chat.persona_id,
                  name: chat.persona_name,
                  role: 'assistant' as const
                }
              : DefaultPersona
          })
        )
        applyState(chatsWithPersona, undefined, { refreshConversation: false })
      }
      setIsChatHydrated(true)
    }

    loadChats()
  }, [applyState, fetchChatsFromDB, createChatInDB])

  return {
    chatRef: chatInstanceRef,
    currentChatId,
    currentChat,
    chatList,
    isChatHydrated,
    getChatById,
    updateChatTitle,
    onCreateChat,
    onCreateDefaultChat,
    onDeleteChat,
    onChangeChat,
    saveMessages
  }
}

export default useChatHook
