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
  BarChart3,
  Bot,
  Briefcase,
  Check,
  ChevronDown,
  Code,
  Database,
  Eraser,
  File,
  FileCode,
  FileJson,
  FileText,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  PenLine,
  Search,
  ToggleLeft,
  ToggleRight,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { StickToBottom } from 'use-stick-to-bottom'

import ChatContext from './chatContext'
import type { ChatMessage, MessageContent } from './interface'
import { Message } from './message'

export interface ChatRef {
  setConversation: (messages: ChatMessage[], chatId?: string | null) => void
  getConversation: () => ChatMessage[]
  focus: () => void
}

const toMessagePayload = (messages: ChatMessage[]) =>
  messages.map(({ role, content }) => ({ role, content }))

const sendChatMessage = async (
  messages: ChatMessage[],
  input: MessageContent
) => {
  const url = '/api/chat'

  const data = {
    messages: toMessagePayload(messages),
    input
  }

  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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

  const [loadingChatId, setLoadingChatId] = useState<string | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [isComposerFocused, setIsComposerFocused] = useState(false)
  const [isComposing, setIsComposing] = useState(false)

  const [message, setMessage] = useState('')
  const [uploadedDocuments, setUploadedDocuments] = useState<
    Array<{
      name: string
      content: string
      mimeType: string
      images?: Array<{ pageNumber: number; name: string; width: number; height: number; dataUrl: string }>
      size?: string
      type?: string
    }>
  >([
    { name: 'product_catalog.json', content: '{"products": [{"id": 1, "name": "Laptop", "price": 999}, {"id": 2, "name": "Mouse", "price": 29}]}', mimeType: 'application/json', size: '2.4 KB', type: 'json' },
    { name: 'company_policies.pdf', content: 'Employee Handbook 2024\n\n1. Working Hours\n2. Leave Policy\n3. Remote Work Guidelines', mimeType: 'application/pdf', size: '156 KB', type: 'pdf' },
    { name: 'customer_data.csv', content: 'id,name,email,plan\n1,John Doe,john@example.com,premium\n2,Jane Smith,jane@example.com,basic', mimeType: 'text/csv', size: '128 KB', type: 'csv' },
    { name: 'api_docs.txt', content: 'API Documentation\n\nGET /api/users - List all users\nPOST /api/users - Create user\nPUT /api/users/:id - Update user\nDELETE /api/users/:id - Delete user', mimeType: 'text/plain', size: '456 B', type: 'txt' },
    { name: 'sales_report.xlsx', content: 'Q1 Sales: $125,000\nQ2 Sales: $143,000\nQ3 Sales: $167,000\nQ4 Sales: $198,000', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: '89 KB', type: 'xlsx' },
    { name: 'database_schema.sql', content: 'CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name VARCHAR(100),\n  email VARCHAR(100) UNIQUE\n);', mimeType: 'text/plain', size: '1.2 KB', type: 'sql' },
  ])

  const [currentMessage, setCurrentMessage] = useState<string>('')
  const [isListening, setIsListening] = useState(false)
  const [fileAccessDropdownOpen, setFileAccessDropdownOpen] = useState(false)
  const [accessibleDocuments, setAccessibleDocuments] = useState<Set<number>>(new Set([0, 1, 3])) // Pre-select some files
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(0)

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const documentInputRef = useRef<HTMLInputElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const fileAccessDropdownRef = useRef<HTMLDivElement | null>(null)
  const agentDropdownRef = useRef<HTMLDivElement | null>(null)
  const isManualStopRef = useRef<boolean>(false)
  const isListeningRef = useRef<boolean>(false)

  // Agent icon component map
  const AgentIcons = {
    briefcase: Briefcase,
    headphones: Headphones,
    barChart3: BarChart3,
    code: Code,
    penLine: PenLine,
    search: Search,
  } as const

  // Sample agents
  const agents = [
    { id: 0, name: 'Sales Agent', description: 'Handles sales inquiries and product questions', icon: 'briefcase', color: 'text-blue-500' },
    { id: 1, name: 'Support Agent', description: 'Customer support and help desk', icon: 'headphones', color: 'text-green-500' },
    { id: 2, name: 'Data Analyst', description: 'Analyzes data and generates reports', icon: 'barChart3', color: 'text-purple-500' },
    { id: 3, name: 'Code Assistant', description: 'Helps with coding and technical questions', icon: 'code', color: 'text-amber-500' },
    { id: 4, name: 'Content Writer', description: 'Creates and edits content', icon: 'penLine', color: 'text-pink-500' },
    { id: 5, name: 'Research Agent', description: 'Conducts research and gathers information', icon: 'search', color: 'text-cyan-500' },
  ]

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
    (Boolean(getComposerText()) || uploadedDocuments.length > 0)
  const textareaClassName =
    'text-foreground w-full min-w-0 resize-none !border-0 !bg-transparent text-base leading-relaxed break-all !outline-none !shadow-none focus:!outline-none focus:!border-0 focus:!ring-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 max-h-[200px] min-h-[24px] overflow-y-auto [field-sizing:content]'

  const ensureActiveChat = useCallback(() => {
    const targetId = conversationChatIdRef.current ?? currentChatId ?? null
    const chat = getChatById(targetId)
    if (chat) {
      conversationChatIdRef.current = chat.id
      return chat
    }
    const created = onCreateDefaultChat?.()
    if (created) {
      conversationChatIdRef.current = created.id
    }
    return created ?? undefined
  }, [currentChatId, getChatById, onCreateDefaultChat])

  const handleDocumentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      const fileType = file.type.toLowerCase()
      const fileName = file.name.toLowerCase()

      // Check if it's a supported document type
      const isSupported =
        fileType === 'text/plain' ||
        fileType === 'text/csv' ||
        fileType === 'application/pdf' ||
        fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        fileType === 'application/vnd.ms-excel' ||
        fileName.endsWith('.txt') ||
        fileName.endsWith('.csv') ||
        fileName.endsWith('.pdf') ||
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls')

      if (!isSupported) {
        toast.error(`Unsupported file type: ${file.name}`)
        continue
      }

      try {
        // Dynamically import the file parser
        const { parseFile } = await import('@/lib/fileParser')
        const parsed = await parseFile(file)

        setUploadedDocuments((prev) => {
          const newIndex = prev.length
          setAccessibleDocuments((prev) => new Set(prev).add(newIndex))
          return [...prev, parsed]
        })
        toast.success(`File "${file.name}" uploaded successfully`)
      } catch (error) {
        console.error('Error parsing file:', error)
        toast.error(`Failed to parse file: ${file.name}`)
      }
    }

    if (documentInputRef.current) {
      documentInputRef.current.value = ''
    }
  }, [])

  const removeDocument = useCallback((index: number) => {
    setUploadedDocuments((prev) => {
      const filtered = prev.filter((_, i) => i !== index)
      // Update accessible indices - remove the index and shift higher indices down
      setAccessibleDocuments((prevSet) => {
        const newSet = new Set<number>()
        prevSet.forEach((i) => {
          if (i < index) {
            newSet.add(i)
          } else if (i > index) {
            newSet.add(i - 1)
          }
        })
        return newSet
      })
      return filtered
    })
  }, [])

  // Initialize speech recognition
  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        fileAccessDropdownOpen &&
        fileAccessDropdownRef.current &&
        !fileAccessDropdownRef.current.contains(event.target as Node)
      ) {
        setFileAccessDropdownOpen(false)
      }
      if (
        agentDropdownOpen &&
        agentDropdownRef.current &&
        !agentDropdownRef.current.contains(event.target as Node)
      ) {
        setAgentDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [fileAccessDropdownOpen, agentDropdownOpen])

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
          let interimTranscript = ''
          let finalTranscript = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript
            } else {
              interimTranscript += transcript
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
            console.log('No speech detected, will auto-restart if still listening')
          } else if (event.error === 'aborted') {
            // Manual abort, don't show error
            console.log('Speech recognition aborted')
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
              console.log('Auto-restarting speech recognition')
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

  const sendMessage = useCallback(
    async (e: React.FormEvent | React.MouseEvent) => {
      if (loadingChatId !== null && loadingChatId === currentChatId) {
        return
      }

      e.preventDefault()
      const input = getComposerText()
      if (input.length < 1 && uploadedDocuments.length === 0) {
        setComposerError('Please enter a message or upload a file to continue.')
        return
      }

      if (!isChatHydrated) {
        setComposerError('Setting up your chat. Please wait a moment.')
        return
      }

      const activeChat = ensureActiveChat()
      if (!activeChat) {
        setComposerError('Setting up your chat. Please wait a moment.')
        return
      }

      const targetChatId = activeChat.id
      activeChatIdRef.current = targetChatId
      const history = [...conversationRef.current]
      const personaPrompt = ''
      // Build message content with text and documents
      let messageContent: MessageContent = input
      if (uploadedDocuments.length > 0) {
        const contentParts: Array<
          | { type: 'text'; text: string }
          | {
              type: 'document'
              name: string
              content: string
              mimeType: string
              images?: Array<{
                pageNumber: number
                name: string
                width: number
                height: number
                dataUrl: string
              }>
            }
        > = []
        if (input) {
          contentParts.push({ type: 'text', text: input })
        }
        uploadedDocuments.forEach((doc, index) => {
          if (accessibleDocuments.has(index)) {
            contentParts.push({
              type: 'document',
              name: doc.name,
              content: doc.content,
              mimeType: doc.mimeType,
              images: doc.images // Include PDF images
            })
          }
        })
        messageContent = contentParts
      }

      const userMessage: ChatMessage = {
        id: generateMessageId(),
        createdAt: new Date().toISOString(),
        content: messageContent,
        role: 'user'
      }
      const pendingConversation = [...history, userMessage]

      setLoadingChatId(targetChatId)
      setComposerError(null)
      setConversation(pendingConversation, targetChatId)
      saveMessages(pendingConversation, targetChatId, { chat: activeChat })
      setMessage('')
      setUploadedDocuments([])
      setCurrentMessage('')

      streamingChatIdRef.current = targetChatId

      try {
        const response = await sendChatMessage(history, messageContent)

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
      uploadedDocuments,
      accessibleDocuments
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

  const clearMessages = () => {
    const chatId = currentChatId ?? null
    if (isCurrentChatLoading) {
      return
    }
    setConversation([], chatId)
    setUploadedDocuments([])
    setAccessibleDocuments(new Set())
  }

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

  const renderComposer = (showClear?: boolean) => {
    const actionAlignment = showClear ? 'justify-between' : 'justify-end'

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
            {!message &&
              !isComposerFocused && (
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
              {/* Agent Selection Dropdown */}
              <div className="relative" ref={agentDropdownRef}>
                  <Button
                    variant="ghost"
                    disabled={isCurrentChatLoading || !isChatHydrated}
                    onClick={() => setAgentDropdownOpen((prev) => !prev)}
                    aria-label="Select agent"
                    title="Select agent"
                    className={`!px-3 !py-2 !h-9 ${agentDropdownOpen ? 'bg-accent' : ''}`}
                  >
                    {(() => {
                      const IconComponent = AgentIcons[agents[selectedAgent]?.icon as keyof typeof AgentIcons] || Bot
                      return (
                        <>
                          <IconComponent className={`size-4 ${agents[selectedAgent]?.color}`} />
                          <ChevronDown className={`size-3 transition-transform ${agentDropdownOpen ? 'rotate-180' : ''}`} />
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
                        <div className="space-y-1">
                          {agents.map((agent) => {
                            const isSelected = selectedAgent === agent.id
                            const IconComponent = AgentIcons[agent.icon as keyof typeof AgentIcons] || Bot
                            return (
                              <button
                                key={agent.id}
                                type="button"
                                onClick={() => {
                                  setSelectedAgent(agent.id)
                                  setAgentDropdownOpen(false)
                                }}
                                className={`group flex w-full items-center gap-3 rounded-md px-3 py-3 transition-colors text-left ${
                                  isSelected ? 'bg-accent' : 'hover:bg-muted/50'
                                }`}
                              >
                                <IconComponent className={`size-5 ${agent.color}`} />
                                <span className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {agent.name}
                                </span>
                                {isSelected && (
                                  <Check className="text-primary ml-auto size-5 shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              {/* File Access Dropdown */}
              <div className="relative" ref={fileAccessDropdownRef}>
                  <Button
                    variant="ghost"
                    disabled={isCurrentChatLoading || !isChatHydrated}
                    onClick={() => setFileAccessDropdownOpen((prev) => !prev)}
                    aria-label="Toggle file access"
                    title="Toggle file access"
                    className={`!p-2 !h-9 ${fileAccessDropdownOpen ? 'bg-accent' : ''}`}
                  >
                    <Database className="size-4" />
                    <ChevronDown className={`size-3 transition-transform ${fileAccessDropdownOpen ? 'rotate-180' : ''}`} />
                  </Button>

                  {fileAccessDropdownOpen && (
                    <div className="border-border bg-popover text-popover-foreground absolute bottom-full left-0 mb-2 w-72 rounded-lg border shadow-lg">
                      <div className="border-border border-b px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">Knowledge Base</h3>
                            <p className="text-muted-foreground text-xs">{accessibleDocuments.size} of {uploadedDocuments.length} files accessible</p>
                          </div>
                          <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
                            <File className="size-4" />
                          </div>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto p-2">
                        {uploadedDocuments.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4 text-sm">No files available</p>
                        ) : (
                          <div className="space-y-1">
                            {uploadedDocuments.map((doc, index) => {
                              const isAccessible = accessibleDocuments.has(index)
                              const getFileIcon = () => {
                                const type = doc.type || ''
                                if (type === 'json') return <FileJson className="text-amber-500 size-4" />
                                if (type === 'pdf') return <FileText className="text-red-500 size-4" />
                                if (type === 'csv' || type === 'xlsx' || type === 'xls') return <Database className="text-green-500 size-4" />
                                if (type === 'sql') return <Database className="text-blue-500 size-4" />
                                return <FileCode className="text-gray-500 size-4" />
                              }
                              return (
                                <div
                                  key={`doc-access-${index}`}
                                  className={`group flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                                    isAccessible ? 'bg-accent' : 'hover:bg-muted/50'
                                  }`}
                                >
                                  <div className={`shrink-0 ${isAccessible ? 'opacity-100' : 'opacity-50'}`}>
                                    {getFileIcon()}
                                  </div>
                                  <span className={`text-sm truncate ${isAccessible ? 'text-foreground font-medium' : 'text-muted-foreground'}`} title={doc.name}>
                                    {doc.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAccessibleDocuments((prev) => {
                                        const newSet = new Set(prev)
                                        if (newSet.has(index)) {
                                          newSet.delete(index)
                                        } else {
                                          newSet.add(index)
                                        }
                                        return newSet
                                      })
                                    }}
                                    className="ml-auto"
                                    aria-label={isAccessible ? 'Disable access' : 'Enable access'}
                                  >
                                    {isAccessible ? (
                                      <Check className="text-primary size-5" />
                                    ) : (
                                      <div className="border-border size-5 rounded-full border" />
                                    )}
                                  </button>
                                </div>
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
                {renderComposer(true)}
              </div>
            </div>
          )}
        </StickToBottom.Content>
      </StickToBottom>
    </div>
  )
}

export default forwardRef<ChatRef, object>(Chat)
