'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { useAppContext } from '@/contexts/app'

import type { Persona } from './interface'
import { DefaultPersona, DefaultPersonas } from './utils'

type PersonaContextValue = {
  defaultPersonas: Persona[]
  personas: Persona[]
  editPersona?: Persona
  isPersonaModalOpen: boolean
  openCreatePersonaModal: () => void
  openEditPersonaModal: (persona: Persona) => void
  closePersonaModal: () => void
  savePersona: (values: { id?: string; name: string; prompt: string }) => void
  deletePersona: (persona: Persona) => void
  getPersonaById: (id: string) => Persona | undefined
  refreshPersonas: () => Promise<void>
}

const PersonaContext = createContext<PersonaContextValue | null>(null)

export const usePersonaContext = () => {
  const context = useContext(PersonaContext)
  if (!context) {
    throw new Error('usePersonaContext must be used within PersonaProvider')
  }
  return context
}

export const PersonaProvider = ({ children }: { children: ReactNode }) => {
  const {
    personaModalOpen,
    openPersonaModal: openPersonaModalFromApp,
    closePersonaModal: closePersonaModalFromApp
  } = useAppContext()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [editPersona, setEditPersona] = useState<Persona | undefined>(undefined)

  // Fetch user's assigned agents from database
  const refreshPersonas = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/agents')
      if (response.ok) {
        const data = await response.json()
        // Convert database agents to persona format
        const agents: Persona[] = (data.agents || []).map(
          (agent: {
            id: string
            name: string
            system_prompt: string
            webhook_url?: string
            is_default?: boolean
          }) => ({
            id: agent.id,
            role: 'system' as const,
            name: agent.name,
            prompt: agent.system_prompt,
            webhookUrl: agent.webhook_url,
            isDefault: agent.is_default
          })
        )
        setPersonas(agents)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
      setPersonas([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch agents on mount
  useEffect(() => {
    refreshPersonas()
  }, [refreshPersonas])

  const closePersonaModal = useCallback(() => {
    setEditPersona(undefined)
    closePersonaModalFromApp()
  }, [closePersonaModalFromApp])

  const openCreatePersonaModal = useCallback(() => {
    setEditPersona(undefined)
    openPersonaModalFromApp()
  }, [openPersonaModalFromApp])

  const openEditPersonaModal = useCallback(
    (persona: Persona) => {
      setEditPersona(persona)
      openPersonaModalFromApp()
    },
    [openPersonaModalFromApp]
  )

  // Note: savePersona and deletePersona are disabled for database agents
  // Agents can only be managed via admin panel
  const savePersona = useCallback(
    () => {
      // This would be for future custom personas - for now just close
      console.warn('savePersona called but custom personas are read-only')
      closePersonaModal()
    },
    [closePersonaModal]
  )

  const deletePersona = useCallback(() => {
    // This would be for future custom personas - for now just close
    console.warn('deletePersona called but custom personas are read-only')
  }, [])

  const getPersonaById = useCallback(
    (id: string) => {
      return (
        personas.find((persona) => persona.id === id) ||
        (id === DefaultPersona.id ? DefaultPersona : undefined)
      )
    },
    [personas]
  )

  const value = useMemo<PersonaContextValue>(
    () => ({
      defaultPersonas: DefaultPersonas,
      personas: loading ? [] : personas,
      editPersona,
      isPersonaModalOpen: personaModalOpen,
      openCreatePersonaModal,
      openEditPersonaModal,
      closePersonaModal,
      savePersona,
      deletePersona,
      getPersonaById,
      refreshPersonas
    }),
    [
      deletePersona,
      editPersona,
      getPersonaById,
      loading,
      openCreatePersonaModal,
      openEditPersonaModal,
      closePersonaModal,
      personaModalOpen,
      personas,
      savePersona,
      refreshPersonas
    ]
  )

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
}
