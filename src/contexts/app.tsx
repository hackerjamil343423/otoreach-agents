'use client'

import {
  createContext,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import { cacheGetJson, cacheSet } from '@/lib/cache'
import { CacheKey } from '@/services/constant'

const SIDEBAR_STORAGE_KEY = 'sidebarToggle'

interface AppContextValue {
  toggleSidebar: boolean
  onToggleSidebar: () => void
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

  return (
    <AppContext.Provider
      value={{
        toggleSidebar,
        onToggleSidebar
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
