'use client'

import { Suspense, useContext } from 'react'
import {
  Chat,
  ChatContext,
  SideBar,
  useChatHook
} from '@/components/chat'

const ChatProvider = () => {
  const provider = useChatHook()

  return (
    <ChatContext.Provider value={provider}>
      <ChatExperience />
    </ChatContext.Provider>
  )
}

const ChatExperience = () => {
  const { chatRef } = useContext(ChatContext)

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative flex flex-1 overflow-hidden">
        <SideBar />
        <div className="relative flex flex-1 flex-col overflow-hidden transition-all duration-300">
          <Chat ref={chatRef} />
        </div>
      </div>
    </div>
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
