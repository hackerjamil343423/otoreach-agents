'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import { cacheGetJson, cacheSet } from '@/lib/cache'

const SIDEBAR_STORAGE_KEY = 'sidebarToggle'

interface AppContextValue {
  toggleSidebar: boolean
  onToggleSidebar: () => void
  themePreset: string
  setThemePreset: (preset: string) => void
  personaPanelOpen: boolean
  openPersonaPanel: () => void
  closePersonaPanel: () => void
  personaModalOpen: boolean
  openPersonaModal: () => void
  closePersonaModal: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider')
  }
  return context
}

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [toggleSidebar, setToggleSidebarState] = useState<boolean>(false)
  const [personaPanelOpen, setPersonaPanelOpen] = useState<boolean>(false)
  const [personaModalOpen, setPersonaModalOpen] = useState<boolean>(false)
  const [themePreset, setThemePresetState] = useState<string>('default')

  useEffect(() => {
    const defaultOpen = window.innerWidth >= 768
    setToggleSidebarState(cacheGetJson<boolean>(SIDEBAR_STORAGE_KEY, defaultOpen))
  }, [])

  const onToggleSidebar = useCallback(() => {
    setToggleSidebarState((prev) => {
      const next = !prev
      cacheSet(SIDEBAR_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const openPersonaPanel = useCallback(() => setPersonaPanelOpen(true), [])
  const closePersonaPanel = useCallback(() => setPersonaPanelOpen(false), [])
  const openPersonaModal = useCallback(() => setPersonaModalOpen(true), [])
  const closePersonaModal = useCallback(() => {
    setPersonaModalOpen(false)
  }, [])
  const setThemePreset = useCallback((preset: string) => {
    setThemePresetState(preset)
  }, [])

  return (
    <AppContext.Provider
      value={{
        toggleSidebar,
        onToggleSidebar,
        themePreset,
        setThemePreset,
        personaPanelOpen,
        openPersonaPanel,
        closePersonaPanel,
        personaModalOpen,
        openPersonaModal,
        closePersonaModal
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
