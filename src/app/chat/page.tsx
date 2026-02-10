'use client'

import { Suspense, useContext, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Chat, ChatContext, PersonaProvider, SideBar, useChatHook } from '@/components/chat'

const ChatProvider = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const provider = useChatHook()

  useEffect(() => {
    // Handle OAuth callback
    const token = searchParams.get('token')
    const userStr = searchParams.get('user')

    if (token && userStr) {
      try {
        // Store token and user from OAuth callback
        localStorage.setItem('auth_token', token)
        localStorage.setItem('user', userStr)
        localStorage.setItem('isAuthenticated', 'true')

        // Clean URL
        window.history.replaceState({}, '', '/chat')
        return
      } catch {
        // Invalid user data, redirect to login
        router.push('/login')
        return
      }
    }

    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    if (isAuthenticated !== 'true') {
      router.push('/login')
    }
  }, [router, searchParams])

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
  return (
    <Suspense>
      <ChatProvider />
    </Suspense>
  )
}

export default ChatPage
