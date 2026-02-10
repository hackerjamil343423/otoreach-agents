'use client'

import { Suspense, useContext, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Chat, ChatContext, PersonaProvider, SideBar, useChatHook } from '@/components/chat'

const ChatProvider = ({ chatId }: { chatId: string }) => {
  const router = useRouter()
  const provider = useChatHook()
  const { isChatHydrated, getChatById, onChangeChat } = provider
  const hasLoadedChat = useRef(false)
  const hasCheckedAuth = useRef(false)

  // Check authentication first (only once)
  useEffect(() => {
    if (hasCheckedAuth.current) return
    hasCheckedAuth.current = true

    const isAuthenticated = localStorage.getItem('isAuthenticated')
    if (isAuthenticated !== 'true') {
      router.push('/login')
    }
  }, [router])

  // Load the specific chat after hydration
  useEffect(() => {
    if (!isChatHydrated || hasLoadedChat.current) return

    const chat = getChatById(chatId)
    if (chat) {
      // Small delay to ensure Chat component has mounted
      const timer = setTimeout(() => {
        onChangeChat(chat)
        hasLoadedChat.current = true
      }, 50)
      return () => clearTimeout(timer)
    } else {
      // Chat not found in list - don't redirect, just mark as loaded
      // The user can create a new chat if needed
      hasLoadedChat.current = true
    }
    return
  }, [isChatHydrated, chatId, getChatById, onChangeChat])

  return (
    <ChatContext.Provider value={provider}>
      <ChatExperience />
    </ChatContext.Provider>
  )
}

const ChatExperience = () => {
  const { chatRef } = useContext(ChatContext)

  return (
    <PersonaProvider>
      <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex flex-1 overflow-hidden">
          <SideBar />
          <div className="relative flex flex-1 flex-col overflow-hidden transition-all duration-300">
            <Chat ref={chatRef} />
          </div>
        </div>
      </div>
    </PersonaProvider>
  )
}

const ChatPage = () => {
  const params = useParams()
  const chatId = params.id as string

  return (
    <Suspense>
      <ChatProvider chatId={chatId} />
    </Suspense>
  )
}

export default ChatPage
