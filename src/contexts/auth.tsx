'use client'

/**
 * Authentication Context Provider
 *
 * Provides global authentication state and methods to the application.
 * Wraps the entire app to provide auth context to all components.
 */
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

export interface User {
  id: string
  email: string
  name: string | null
}

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Validate session on mount and when visibility changes
   */
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.authenticated && data.user) {
          setUser(data.user)
          // Store in localStorage for backward compatibility
          localStorage.setItem('user', JSON.stringify(data.user))
          localStorage.setItem('isAuthenticated', 'true')
        } else {
          setUser(null)
          clearUserStorage()
        }
      } else {
        setUser(null)
        clearUserStorage()
      }
    } catch (err) {
      console.error('Session validation error:', err)
      setUser(null)
      clearUserStorage()
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Clear user storage (localStorage)
   */
  const clearUserStorage = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('auth_token')
  }

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        return { success: false, error: data.error || 'Login failed' }
      }

      if (data.success && data.user) {
        setUser(data.user)
        // Store in localStorage for backward compatibility
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('isAuthenticated', 'true')
        return { success: true }
      }

      setError('Login failed')
      return { success: false, error: 'Login failed' }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Logout current user
   */
  const logout = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setUser(null)
      clearUserStorage()
      setIsLoading(false)
    }
  }, [])

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Validate session on mount
  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  // Refresh session when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshSession])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
    refreshSession,
    clearError
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context
 * Throws error if used outside of AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Hook to access auth context safely (returns null if not in provider)
 */
export const useAuthSafe = (): AuthContextType | null => {
  return useContext(AuthContext)
}
