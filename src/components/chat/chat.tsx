/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { ensureMessageIds, generateMessageId } from '@/components/chat/utils'
import { Button } from '@/components/ui/button'
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Loader2,
  Mic,
  MicOff
} from 'lucide-react'
import { toast } from 'sonner'
import { StickToBottom } from 'use-stick-to-bottom'

import ChatContext from './chatContext'
import type { ChatMessage } from './interface'
import { Message } from './message'
import { usePersonaContext } from './personaContext'
import { useUserProjects } from '@/hooks/useUserProjects'
import { FolderOpen } from 'lucide-react'

export interface ChatRef {
  setConversation: (messages: ChatMessage[], chatId?: string | null) => void
  getConversation: () => ChatMessage[]
  focus: () => void
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token')
  const user = localStorage.getItem('user')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else if (user) {
    try {
      const userData = JSON.parse(user)
      if (userData.email) {
        headers['x-user-email'] = userData.email
      }
    } catch {
      // Invalid user data
    }
  }

  return headers
}

// Send chat message to API
// input: text only
// context: selected category and sub-project info
const sendChatMessage = async (
  input: string, 
  context?: {
    category?: string
    sub_category?: string
    sub_project_name?: string
    project_id?: string
    sub_project_id?: string
  },
  agentId?: string, 
  chatId?: string
) => {
  const url = '/api/chat'

  const data: {
    input: string
    context?: typeof context
    agentId?: string
    chatId?: string
  } = {
    input,
    agentId,
    chatId
  }

  // Only include context if category or sub-project is selected
  if (context && (context.category || context.sub_project_name)) {
    data.context = context
  }

  return await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  })
}

type ConversationUpdater = ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])

const Chat = (_: object, ref: React.ForwardedRef<ChatRef>) => {
  const {
    currentChat,
    currentChatId,
    saveMessages,
    isChatHydrated,
    getChatById,
    onCreateDefaultChat
  } = useContext(ChatContext)
  const { personas: agents } = usePersonaContext()

  const [loadingChatId, setLoadingChatId] = useState<string | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [isComposerFocused, setIsComposerFocused] = useState(false)
  const [isComposing, setIsComposing] = useState(false)

  const [message, setMessage] = useState('')

  // Project selection state (must be before useUserDocuments)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedSubProjectId, setSelectedSubProjectId] = useState<string | null>(null)
  const [subProjectDropdownOpen, setSubProjectDropdownOpen] = useState(false)
  const projectDropdownRef = useRef<HTMLDivElement | null>(null)
  const subProjectDropdownRef = useRef<HTMLDivElement | null>(null)

  // Fetch user's projects
  const { projects, subProjects, fetchSubProjects } = useUserProjects()

  const [currentMessage, setCurrentMessage] = useState<string>('')
  const [isListening, setIsListening] = useState(false)
  
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const agentDropdownRef = useRef<HTMLDivElement | null>(null)
  const isManualStopRef = useRef<boolean>(false)
  const isListeningRef = useRef<boolean>(false)

  const getComposerValue = useCallback(() => textAreaRef.current?.value ?? message ?? '', [message])
  const getComposerText = useCallback(() => getComposerValue().trim(), [getComposerValue])

  const [conversation, setConversationState] = useState<ChatMessage[]>([])
  const conversationRef = useRef<ChatMessage[]>([])
  const conversationChatIdRef = useRef<string | undefined>(undefined)
  const activeChatIdRef = useRef<string | null>(null)
  const streamingChatIdRef = useRef<string | null>(null)
  const setConversation = useCallback(
    (updater: ConversationUpdater, chatId?: string | null) => {
      setConversationState((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (prev: ChatMessage[]) => ChatMessage[])(prev)
            : updater
        const nextWithIds = ensureMessageIds(next)
        conversationRef.current = nextWithIds
        const resolvedChatId =
          chatId === null ? undefined : (chatId ?? currentChatId ?? conversationChatIdRef.current)
        conversationChatIdRef.current = resolvedChatId
        return nextWithIds
      })
    },
    [currentChatId]
  )

  const chatInputId = useId()
  const helperTextId = useId()
  const errorTextId = useId()
  const isCurrentChatLoading = loadingChatId !== null && loadingChatId === currentChatId
  const hasActiveChat = Boolean(currentChatId ?? conversationChatIdRef.current)
  const canSend =
    isChatHydrated &&
    hasActiveChat &&
    !isCurrentChatLoading &&
    Boolean(getComposerText())
  const textareaClassName =
    'text-foreground w-full min-w-0 resize-none !border-0 !bg-transparent text-base leading-relaxed break-all !outline-none !shadow-none focus:!outline-none focus:!border-0 focus:!ring-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 max-h-[200px] min-h-[24px] overflow-y-auto [field-sizing:content]'

  const ensureActiveChat = useCallback(async () => {
    // If currentChatId was intentionally cleared, don't auto-select old chat
    const targetId = conversationChatIdRef.current ?? currentChatId ?? null

    // Only look up chat if we have a target ID
    const chat = targetId ? getChatById(targetId) : null

    if (chat) {
      conversationChatIdRef.current = chat.id
      return chat
    }

    // No chat selected - create new one
    const created = await onCreateDefaultChat?.()
    if (created) {
      conversationChatIdRef.current = created.id
    }
    return created ?? undefined
  }, [currentChatId, getChatById, onCreateDefaultChat])

  // Initialize speech recognition
  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        agentDropdownOpen &&
        agentDropdownRef.current &&
        !agentDropdownRef.current.contains(event.target as Node)
      ) {
        setAgentDropdownOpen(false)
      }
      if (
        projectDropdownOpen &&
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target as Node)
      ) {
        setProjectDropdownOpen(false)
      }
      if (
        subProjectDropdownOpen &&
        subProjectDropdownRef.current &&
        !subProjectDropdownRef.current.contains(event.target as Node)
      ) {
        setSubProjectDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [agentDropdownOpen, projectDropdownOpen, subProjectDropdownOpen])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'zh-CN' // Set to Chinese, you can make this configurable

        recognition.onresult = (event: any) => {
          let finalTranscript = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript
            }
          }

          if (finalTranscript) {
            setMessage((prev) => prev + finalTranscript)
          }
        }

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)

          // Handle different error types
          if (event.error === 'not-allowed') {
            setIsListening(false)
            isListeningRef.current = false
            isManualStopRef.current = true
            toast.error('Microphone access denied. Please allow microphone access in your browser.')
          } else if (event.error === 'no-speech') {
            // Don't show error for no-speech - it's common during pauses
            // The recognition will auto-restart via onend handler
          } else if (event.error === 'aborted') {
            // Manual abort, don't show error
          } else {
            setIsListening(false)
            isListeningRef.current = false
            isManualStopRef.current = true
            toast.error('Speech recognition error: ' + event.error)
          }
        }

        recognition.onend = () => {
          // If it was a manual stop, just update state
          if (isManualStopRef.current) {
            setIsListening(false)
            isListeningRef.current = false
            isManualStopRef.current = false
            return
          }

          // Auto-restart if it stopped unexpectedly and user hasn't manually stopped
          // This handles browser auto-stop after silence
          if (isListeningRef.current) {
            try {
              recognition.start()
            } catch (error) {
              console.error('Failed to auto-restart speech recognition:', error)
              setIsListening(false)
              isListeningRef.current = false
            }
          } else {
            setIsListening(false)
            isListeningRef.current = false
          }
        }

        recognitionRef.current = recognition
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in your browser.')
      return
    }

    if (isListening) {
      try {
        isManualStopRef.current = true
        recognitionRef.current.stop()
        // Don't set state here - let onend handler do it
      } catch (error) {
        console.error('Error stopping speech recognition:', error)
        isManualStopRef.current = true
        setIsListening(false)
        isListeningRef.current = false
      }
    } else {
      try {
        isManualStopRef.current = false
        recognitionRef.current.start()
        setIsListening(true)
        isListeningRef.current = true
        toast.success('Listening... Speak now')
      } catch (error) {
        console.error('Error starting speech recognition:', error)
        setIsListening(false)
        isListeningRef.current = false
        toast.error('Failed to start speech recognition')
      }
    }
  }, [isListening])

  useEffect(() => {
    activeChatIdRef.current = currentChatId ?? null
  }, [currentChatId])

  // Clear conversation when currentChatId is cleared (New Chat clicked)
  useEffect(() => {
    if (!currentChatId) {
      conversationChatIdRef.current = undefined
      setConversation([])
    }
  }, [currentChatId])

  const sendMessage = useCallback(
    async (e: React.FormEvent | React.MouseEvent) => {
      if (loadingChatId !== null && loadingChatId === currentChatId) {
        return
      }

      e.preventDefault()
      const input = getComposerText()
      
      // Require text input - cannot send empty messages even with files
      if (!input || input.length < 1) {
        setComposerError('Please enter a message to continue.')
        return
      }

      if (!isChatHydrated) {
        setComposerError('Setting up your chat. Please wait a moment.')
        return
      }

      const activeChat = await ensureActiveChat()
      if (!activeChat) {
        setComposerError('Setting up your chat. Please wait a moment.')
        return
      }

      const targetChatId = activeChat.id
      activeChatIdRef.current = targetChatId
      const history = [...conversationRef.current]
      
      // Get selected sub-project name
      const selectedSubProjectName = selectedSubProjectId 
        ? (subProjects[selectedProjectId || ''] || []).find(sp => sp.id === selectedSubProjectId)?.name 
        : undefined

      // Build context data with sub-project names
      const contextData = {
        sub_project_name: selectedSubProjectName,
        project_id: selectedProjectId || undefined,
        sub_project_id: selectedSubProjectId || undefined
      }

      // Message content is text only (for display in chat)
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        createdAt: new Date().toISOString(),
        content: input, // Text only
        role: 'user'
      }
      const pendingConversation = [...history, userMessage]

      setLoadingChatId(targetChatId)
      setComposerError(null)
      setConversation(pendingConversation, targetChatId)
      saveMessages(pendingConversation, targetChatId, { chat: activeChat })
      setMessage('')
      setCurrentMessage('')

      streamingChatIdRef.current = targetChatId

      try {
        const response = await sendChatMessage(
          input,
          contextData,
          selectedAgentId || undefined,
          targetChatId
        )

        if (response.ok) {
          const data = response.body

          if (!data) {
            throw new Error('No data')
          }

          const reader = data.getReader()
          const decoder = new TextDecoder('utf-8')
          let done = false
          let resultContent = ''
          let frameHandle: number | null = null
          let chunkBuffer = ''

          const flushBuffer = () => {
            if (!chunkBuffer) return
            resultContent += chunkBuffer
            chunkBuffer = ''
            const isCurrentChatActive =
              streamingChatIdRef.current === targetChatId &&
              activeChatIdRef.current === targetChatId
            if (isCurrentChatActive) {
              setCurrentMessage(resultContent)
            }
          }

          while (!done) {
            try {
              const { value, done: readerDone } = await reader.read()
              const char = decoder.decode(value, { stream: true })
              if (char) {
                chunkBuffer += char
                if (frameHandle === null) {
                  frameHandle = requestAnimationFrame(() => {
                    flushBuffer()
                    frameHandle = null
                  })
                }
              }
              done = readerDone
            } catch {
              done = true
            }
          }

          if (frameHandle !== null) {
            cancelAnimationFrame(frameHandle)
            frameHandle = null
          }
          flushBuffer()

          const finalAssistantMessage: ChatMessage = {
            id: generateMessageId(),
            createdAt: new Date().toISOString(),
            content: resultContent,
            role: 'assistant'
          }
          const finalConversation: ChatMessage[] = [...pendingConversation, finalAssistantMessage]

          if (activeChatIdRef.current === targetChatId) {
            setConversation(finalConversation, targetChatId)
          }
          saveMessages(finalConversation, targetChatId, { chat: activeChat })
          if (
            streamingChatIdRef.current === targetChatId &&
            activeChatIdRef.current === targetChatId
          ) {
            setCurrentMessage('')
          }
        } else {
          const result = await response.json()
          toast.error(result.error)
          setComposerError('Unable to send message. Please try again.')
        }
      } catch (error) {
        console.error(error)
        toast.error(error instanceof Error ? error.message : 'Unknown error')
        setComposerError('Something went wrong. Please try again.')
      } finally {
        if (streamingChatIdRef.current === targetChatId) {
          streamingChatIdRef.current = null
        }
        setLoadingChatId((prev) => (prev === targetChatId ? null : prev))
      }
    },
    [
      isChatHydrated,
      ensureActiveChat,
      getComposerText,
      currentChatId,
      loadingChatId,
      saveMessages,
      setConversation,
      selectedAgentId,
      selectedProjectId,
      selectedSubProjectId,
      subProjects
    ]
  )

  const handleKeypress = useCallback(
    (e: React.KeyboardEvent) => {
      // Block submission during IME composition (e.g., Chinese/Japanese/Korean input)
      if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
        e.preventDefault()
        if (!isChatHydrated || isCurrentChatLoading) {
          return
        }
        const input = getComposerText()
        if (!input) {
          setComposerError('Please enter a message to continue.')
          return
        }
        sendMessage(e)
      }
    },
    [getComposerText, isChatHydrated, isComposing, isCurrentChatLoading, sendMessage]
  )

  useEffect(() => {
    if (currentChatId) {
      conversationChatIdRef.current = currentChatId
    }
  }, [currentChatId])

  useEffect(() => {
    if (!currentChat?.id) {
      setCurrentMessage('')
      return
    }
    if (streamingChatIdRef.current && streamingChatIdRef.current !== currentChat.id) {
      setCurrentMessage('')
    }
  }, [currentChat?.id])

  useEffect(() => {
    if (!currentChatId) {
      return
    }
    if (!isChatHydrated) {
      return
    }
    if (conversationChatIdRef.current !== currentChatId) {
      setCurrentMessage('')
    }
  }, [currentChatId, isChatHydrated])

  useEffect(() => {
    if (!isChatHydrated) {
      return
    }
    const targetChatId = conversationChatIdRef.current ?? currentChatId
    if (!targetChatId) {
      return
    }
    saveMessages(conversation, targetChatId)
  }, [conversation, currentChatId, isChatHydrated, saveMessages])

  useEffect(() => {
    if (!isCurrentChatLoading) {
      textAreaRef.current?.focus()
    }
  }, [isCurrentChatLoading])

  const renderComposer = () => {
    return (
      <div className="relative">
        <div className="bg-background border-border focus-within:ring-ring focus-within:border-ring has-[textarea[aria-invalid=true]]:border-destructive has-[textarea[aria-invalid=true]]:ring-destructive/20 flex flex-col rounded-2xl border shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 focus-within:ring-2 has-[textarea[aria-invalid=true]]:ring-2 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.2)]">
          <div className="relative flex min-h-[44px] min-w-0 flex-1 items-start px-4 pt-2 pb-1">
            <label className="sr-only" htmlFor={chatInputId}>
              Message input
            </label>
            <p id={helperTextId} className="sr-only">
              Press Enter to send your message. Use Shift plus Enter to insert a new line.
            </p>
            {!message && !isComposerFocused && (
              <span className="text-foreground/50 pointer-events-none absolute top-2 left-4 text-base">
                Ask anything
              </span>
            )}
            <textarea
              ref={textAreaRef}
              rows={1}
              className={textareaClassName}
              value={message}
              disabled={isCurrentChatLoading || !isChatHydrated}
              id={chatInputId}
              aria-invalid={!!composerError}
              aria-describedby={composerError ? `${helperTextId} ${errorTextId}` : helperTextId}
              onFocus={() => setIsComposerFocused(true)}
              onBlur={() => setIsComposerFocused(false)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setMessage(e.target.value)
                setComposerError(null)
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                handleKeypress(e)
              }}
            />
          </div>

          <div className={`flex items-center justify-between px-3 pb-3`}>
            <div className="flex items-center gap-2">
              {/* Project Selection Dropdown */}
              <div className="relative" ref={projectDropdownRef}>
                <Button
                  variant="ghost"
                  disabled={isCurrentChatLoading || !isChatHydrated}
                  onClick={() => {
                    setProjectDropdownOpen((prev) => !prev)
                    if (!projectDropdownOpen && selectedProjectId) {
                      void fetchSubProjects(selectedProjectId)
                    }
                  }}
                  aria-label="Select project"
                  title="Select project"
                  className={`!h-9 !px-3 !py-2 ${projectDropdownOpen ? 'bg-accent' : ''}`}
                >
                  {(() => {
                    const selectedProject = projects.find((p) => p.id === selectedProjectId)
                    return (
                      <>
                        <FolderOpen className="size-4" />
                        <span className="ml-2 text-sm max-w-[80px] truncate">
                          {selectedProject?.name || 'Project'}
                        </span>
                        <ChevronDown
                          className={`size-3 transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </>
                    )
                  })()}
                </Button>

                {projectDropdownOpen && (
                  <div className="border-border bg-popover text-popover-foreground absolute bottom-full left-0 mb-2 w-64 rounded-lg border shadow-lg">
                    <div className="border-border border-b px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">Select Project</h3>
                          <p className="text-muted-foreground text-xs">Choose a project</p>
                        </div>
                        <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
                          <FolderOpen className="size-4" />
                        </div>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-2">
                      {projects.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                          No projects available
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {projects.map((project) => {
                            const isSelected = selectedProjectId === project.id
                            return (
                              <button
                                key={project.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProjectId(project.id)
                                  setSelectedSubProjectId(null)
                                  void fetchSubProjects(project.id)
                                  setProjectDropdownOpen(false)
                                  setSubProjectDropdownOpen(true)
                                }}
                                className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                                  isSelected ? 'bg-accent' : 'hover:bg-muted/50'
                                }`}
                              >
                                <span className="text-lg">{project.icon}</span>
                                <span
                                  className={`text-sm font-medium truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                                >
                                  {project.name}
                                </span>
                                {isSelected && (
                                  <Check className="text-primary ml-auto size-4 shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-Project Selection Dropdown */}
              {selectedProjectId && (
                <div className="relative" ref={subProjectDropdownRef}>
                  <Button
                    variant="ghost"
                    disabled={isCurrentChatLoading || !isChatHydrated}
                    onClick={() => setSubProjectDropdownOpen((prev) => !prev)}
                    aria-label="Select sub-project"
                    title="Select sub-project"
                    className={`!h-9 !px-3 !py-2 ${subProjectDropdownOpen ? 'bg-accent' : ''}`}
                  >
                    {(() => {
                      const projectSubProjects = subProjects[selectedProjectId] || []
                      const selectedSubProject = projectSubProjects.find((sp) => sp.id === selectedSubProjectId)
                      return (
                        <>
                          <span className="text-sm max-w-[80px] truncate">
                            {selectedSubProject?.name || 'Sub-project'}
                          </span>
                          <ChevronDown
                            className={`size-3 transition-transform ${subProjectDropdownOpen ? 'rotate-180' : ''}`}
                          />
                        </>
                      )
                    })()}
                  </Button>

                  {subProjectDropdownOpen && (
                    <div className="border-border bg-popover text-popover-foreground absolute bottom-full left-0 mb-2 w-64 rounded-lg border shadow-lg">
                      <div className="border-border border-b px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">Select Sub-Project</h3>
                            <p className="text-muted-foreground text-xs">
                              {projects.find(p => p.id === selectedProjectId)?.name}
                            </p>
                          </div>
                          <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
                            <FolderOpen className="size-4" />
                          </div>
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-2">
                        {(() => {
                          const projectSubProjects = subProjects[selectedProjectId] || []
                          if (projectSubProjects.length === 0) {
                            return (
                              <p className="text-muted-foreground py-4 text-center text-sm">
                                No sub-projects available
                              </p>
                            )
                          }
                          return (
                            <div className="space-y-1">
                              {projectSubProjects.map((subProject) => {
                                const isSelected = selectedSubProjectId === subProject.id
                                return (
                                  <button
                                    key={subProject.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSubProjectId(subProject.id)
                                      setSubProjectDropdownOpen(false)
                                    }}
                                    className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                                      isSelected ? 'bg-accent' : 'hover:bg-muted/50'
                                    }`}
                                  >
                                    <span className="text-lg">{subProject.icon}</span>
                                    <span
                                      className={`text-sm font-medium truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                                    >
                                      {subProject.name}
                                    </span>
                                    {isSelected && (
                                      <Check className="text-primary ml-auto size-4 shrink-0" />
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Selection Dropdown */}
              <div className="relative" ref={agentDropdownRef}>
                <Button
                  variant="ghost"
                  disabled={isCurrentChatLoading || !isChatHydrated}
                  onClick={() => setAgentDropdownOpen((prev) => !prev)}
                  aria-label="Select agent"
                  title="Select agent"
                  className={`!h-9 !px-3 !py-2 ${agentDropdownOpen ? 'bg-accent' : ''}`}
                >
                  {(() => {
                    const selectedAgent = agents.find((a) => a.id === selectedAgentId)
                    return (
                      <>
                        <Bot className="size-4" />
                        <span className="ml-2 text-sm">
                          {selectedAgent?.name || 'Select Agent'}
                        </span>
                        <ChevronDown
                          className={`size-3 transition-transform ${agentDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </>
                    )
                  })()}
                </Button>

                {agentDropdownOpen && (
                  <div className="border-border bg-popover text-popover-foreground absolute bottom-full left-0 mb-2 w-64 rounded-lg border shadow-lg">
                    <div className="border-border border-b px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">Select Agent</h3>
                          <p className="text-muted-foreground text-xs">Choose an AI agent</p>
                        </div>
                        <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
                          <Bot className="size-4" />
                        </div>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {agents.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                          No agents assigned
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {agents.map((agent) => {
                            const isSelected = selectedAgentId === agent.id
                            return (
                              <button
                                key={agent.id}
                                type="button"
                                onClick={() => {
                                  setSelectedAgentId(agent.id || null)
                                  setAgentDropdownOpen(false)
                                }}
                                className={`group flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors ${
                                  isSelected ? 'bg-accent' : 'hover:bg-muted/50'
                                }`}
                              >
                                <Bot className="size-5" />
                                <span
                                  className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                                >
                                  {agent.name}
                                </span>
                                {isSelected && (
                                  <Check className="text-primary ml-auto size-5 shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {isCurrentChatLoading ? (
              <div
                className="flex items-center justify-center p-2"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={isCurrentChatLoading || !isChatHydrated}
                  onClick={toggleVoiceInput}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  title={isListening ? 'Stop voice input' : 'Start voice input'}
                  className={isListening ? 'text-destructive rounded-full' : 'rounded-full'}
                >
                  {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </Button>
                <Button
                  size="icon-sm"
                  disabled={!canSend}
                  className="rounded-full"
                  onClick={sendMessage}
                  aria-label="Send message"
                  title="Send message"
                >
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        {composerError && (
          <div
            id={errorTextId}
            className="bg-destructive/10 text-foreground animate-in fade-in slide-in-from-top-1 mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs duration-200"
            role="alert"
          >
            <AlertCircle className="text-destructive size-3.5 shrink-0" />
            <span className="font-medium">{composerError}</span>
          </div>
        )}
      </div>
    )
  }

  useImperativeHandle(ref, () => {
    return {
      setConversation(messages: ChatMessage[], chatId?: string | null) {
        setConversation(messages, chatId)
      },
      getConversation() {
        return conversationRef.current
      },
      focus: () => {
        textAreaRef.current?.focus()
      }
    }
  }, [setConversation])

  return (
    <div className="bg-background text-foreground relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <StickToBottom
        className="relative min-h-0 flex-1 overflow-y-auto"
        initial="smooth"
        resize="smooth"
      >
        <StickToBottom.Content className="flex min-h-full flex-col">
          {/* Main chat area */}
          <div className="@container/chat mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-3 md:px-6 lg:px-8">
            {!isChatHydrated ? (
              <div className="flex h-full min-h-[60vh] items-center justify-center">
                <div className="text-muted-foreground flex items-center gap-3 text-sm">
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  <span>Loading your chats…</span>
                </div>
              </div>
            ) : conversation.length === 0 ? (
              <div className="flex h-full min-h-[60vh] flex-col items-center justify-center space-y-8">
                <div className="space-y-4 text-center">
                  <div className="bg-secondary text-secondary-foreground mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
                    <span className="text-2xl">✨</span>
                  </div>
                  <h1 className="text-foreground text-3xl font-normal md:text-4xl">
                    Hello, I&apos;m here to help
                  </h1>
                </div>
                <div className="w-full max-w-2xl">{renderComposer()}</div>
              </div>
            ) : (
              <div className="space-y-4">
                {conversation.map((item) => (
                  <Message key={item.id} message={item} />
                ))}
                {currentMessage && (
                  <Message
                    key="streaming"
                    message={{
                      id: 'streaming',
                      createdAt: conversation.at(-1)?.createdAt ?? new Date().toISOString(),
                      content: currentMessage,
                      role: 'assistant'
                    }}
                  />
                )}
              </div>
            )}
          </div>
          {/* Input area - only show at bottom when there are messages */}
          {conversation.length > 0 && (
            <div className="bg-background sticky bottom-0 mt-auto">
              <div className="@container/chat mx-auto w-full max-w-5xl px-4 pt-0 pb-2 md:px-6 lg:px-8">
                {renderComposer()}
              </div>
            </div>
          )}
        </StickToBottom.Content>
      </StickToBottom>
    </div>
  )
}

export default forwardRef<ChatRef, object>(Chat)
