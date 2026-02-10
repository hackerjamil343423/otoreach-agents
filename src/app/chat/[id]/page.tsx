'use client'

import { Suspense, useContext, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Chat, ChatContext, PersonaProvider, SideBar, useChatHook } from '@/components/chat'

const ChatProvider = ({ chatId }: { chatId: string }) => {
  const router = useRouter()
  const provider = useChatHook()

  // Load the specific chat when component mounts
  useEffect(() => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    if (isAuthenticated !== 'true') {
      router.push('/login')
      return
    }

    // Load the specific chat by ID
    const loadChatById = async () => {
      const { getChatById, onChangeChat } = provider
      const chat = getChatById(chatId)
      if (chat) {
        onChangeChat(chat)
      } else {
        // Chat not found, redirect to main chat page
        router.push('/chat')
      }
    }

    loadChatById()
  }, [chatId, provider, router])

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
