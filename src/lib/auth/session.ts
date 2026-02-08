/**
 * Database-Backed Session Management
 *
 * Manages user and admin sessions with JWT tokens stored in the database.
 * Provides secure session creation, validation, and invalidation.
 */

import { sql } from '@/lib/db'

import { generateToken, verifyToken, type TokenPayload, type TokenValidationResult } from './jwt'

export interface Session {
  id: string
  user_id: string
  token: string
  expires_at: string
  created_at: string
}

export interface SessionValidationResult {
  valid: boolean
  session: Session | null
  payload: TokenPayload | null
  error?: string
}

/**
 * Create a new session for a user or admin
 * @param userId - The user ID
 * @param type - The session type ('user' or 'admin')
 * @param email - The user's email (included in the token)
 * @returns The created session with token
 */
export async function createSession(
  userId: string,
  email: string,
  type: 'user' | 'admin' = 'user'
): Promise<Session> {
  // Generate JWT token
  const token = generateToken({ userId, email, type })

  // Calculate expiry (24 hours from now)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Insert session into database
  const result = await sql`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (gen_random_uuid(), ${userId}, ${token}, ${expiresAt})
    RETURNING *
  `

  return result[0] as Session
}

/**
 * Validate a session token against the database
 * @param token - The session token to validate
 * @returns The validation result with session and payload
 */
export async function validateSession(token: string): Promise<SessionValidationResult> {
  // First, verify the JWT signature and expiry
  const jwtResult: TokenValidationResult = verifyToken(token)

  if (!jwtResult.valid || !jwtResult.payload) {
    return {
      valid: false,
      session: null,
      payload: null,
      error: jwtResult.error || 'Invalid token'
    }
  }

  // Check if session exists in database and hasn't expired
  const result = await sql`
    SELECT * FROM sessions
    WHERE token = ${token} AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `

  if (!result || result.length === 0) {
    return {
      valid: false,
      session: null,
      payload: null,
      error: 'Session not found or expired'
    }
  }

  return {
    valid: true,
    session: result[0] as Session,
    payload: jwtResult.payload
  }
}

/**
 * Invalidate a specific session (logout)
 * @param token - The session token to invalidate
 */
export async function invalidateSession(token: string): Promise<void> {
  await sql`
    DELETE FROM sessions WHERE token = ${token}
  `
}

/**
 * Invalidate all sessions for a user
 * @param userId - The user ID
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await sql`
    DELETE FROM sessions WHERE user_id = ${userId}
  `
}

/**
 * Clean up expired sessions from the database
 * Should be run periodically (e.g., via cron job)
 * @returns The number of sessions cleaned up
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await sql`
    DELETE FROM sessions
    WHERE expires_at <= NOW()
    RETURNING id
  `
  return result.length
}

/**
 * Get all active sessions for a user
 * @param userId - The user ID
 * @returns Array of active sessions
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  const result = await sql`
    SELECT * FROM sessions
    WHERE user_id = ${userId} AND expires_at > NOW()
    ORDER BY created_at DESC
  `
  return result as Session[]
}

/**
 * Extend a session's expiry time
 * @param token - The session token to extend
 * @param hours - Number of hours to extend (default: 24)
 * @returns The updated session or null
 */
export async function extendSession(token: string, hours: number = 24): Promise<Session | null> {
  const newExpiry = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

  const result = await sql`
    UPDATE sessions
    SET expires_at = ${newExpiry}
    WHERE token = ${token} AND expires_at > NOW()
    RETURNING *
  `

  return result.length > 0 ? (result[0] as Session) : null
}

/**
 * Get session count for a user (for session management UI)
 * @param userId - The user ID
 * @returns The number of active sessions
 */
export async function getUserSessionCount(userId: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count FROM sessions
    WHERE user_id = ${userId} AND expires_at > NOW()
  `
  return parseInt(result[0]?.count || '0', 10)
}
