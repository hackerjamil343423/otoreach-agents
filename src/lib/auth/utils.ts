/**
 * Centralized Authentication Utilities
 *
 * Shared helper functions for authentication across the application.
 * Replaces duplicated code in multiple files.
 */

import { cookies } from 'next/headers'

import { validateSession, type SessionValidationResult } from './session'

export interface AuthHeaders {
  Authorization?: string
  'x-user-email'?: string
}

/**
 * Get authentication headers for API requests
 * For use in client-side components or API routes
 *
 * @returns Object with Authorization header or x-user-email header
 */
export async function getAuthHeaders(): Promise<AuthHeaders> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (token) {
    return { Authorization: `Bearer ${token}` }
  }

  // Fallback to email header (for backward compatibility)
  const userCookie = cookieStore.get('user')?.value
  if (userCookie) {
    try {
      const user = JSON.parse(userCookie)
      return { 'x-user-email': user.email }
    } catch {
      return {}
    }
  }

  return {}
}

/**
 * Validate current user session
 *
 * @returns Session validation result or null
 */
export async function getCurrentSession(): Promise<SessionValidationResult | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    return null
  }

  return await validateSession(token)
}

/**
 * Check if current request is authenticated
 *
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession()
  return session !== null && session.valid === true
}

/**
 * Get current user ID from session
 *
 * @returns User ID or null
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getCurrentSession()
  if (session && session.valid && session.payload) {
    return session.payload.userId
  }
  return null
}

/**
 * Get current user email from session
 *
 * @returns User email or null
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  const session = await getCurrentSession()
  if (session && session.valid && session.payload) {
    return session.payload.email
  }
  return null
}

/**
 * Check if current user is an admin
 *
 * @returns true if admin, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value

  if (!token) {
    return false
  }

  const session = await validateSession(token)
  return session.valid === true && session.payload?.type === 'admin'
}

/**
 * Parse user from cookie (for client-side use)
 * NOTE: This is for backward compatibility. New code should use getCurrentSession()
 *
 * @returns User object or null
 */
export function getUserFromCookie(): { id: string; email: string; name: string | null } | null {
  if (typeof document === 'undefined') {
    return null
  }

  const userStr = localStorage.getItem('user')
  if (!userStr) {
    return null
  }

  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

/**
 * Set user in localStorage (for client-side use)
 * NOTE: This is for backward compatibility.
 */
export function setUserInCookie(user: { id: string; email: string; name: string | null }): void {
  if (typeof document === 'undefined') {
    return
  }

  localStorage.setItem('user', JSON.stringify(user))
  localStorage.setItem('isAuthenticated', 'true')
}

/**
 * Clear user from localStorage (for client-side use)
 */
export function clearUserFromCookie(): void {
  if (typeof document === 'undefined') {
    return
  }

  localStorage.removeItem('user')
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('auth_token')
}

/**
 * Format error message for auth failures
 */
export function formatAuthError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An authentication error occurred'
}
