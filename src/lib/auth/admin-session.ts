/**
 * Admin Session Management
 *
 * Manages admin sessions with JWT tokens stored in the database.
 * Uses the admin_sessions table which references admin_users.
 */

import { sql } from '@/lib/db'

import { generateToken, verifyToken, type TokenPayload, type TokenValidationResult } from './jwt'

export interface AdminSession {
  id: string
  admin_id: string
  token: string
  expires_at: string
  created_at: string
}

export interface AdminSessionValidationResult {
  valid: boolean
  session: AdminSession | null
  payload: TokenPayload | null
  error?: string
}

/**
 * Create a new admin session
 * @param adminId - The admin ID
 * @param email - The admin's email (included in the token)
 * @returns The created session with token
 */
export async function createAdminSession(adminId: string, email: string): Promise<AdminSession> {
  // Generate JWT token with admin type
  const token = generateToken({ userId: adminId, email, type: 'admin' })

  // Calculate expiry (24 hours from now)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Insert session into admin_sessions table
  const result = await sql`
    INSERT INTO admin_sessions (admin_id, token, expires_at)
    VALUES (${adminId}, ${token}, ${expiresAt})
    RETURNING *
  `

  return result[0] as AdminSession
}

/**
 * Validate an admin session token against the database
 * @param token - The session token to validate
 * @returns The validation result with session and payload
 */
export async function validateAdminSession(token: string): Promise<AdminSessionValidationResult> {
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

  // Check if it's an admin token
  if (jwtResult.payload.type !== 'admin') {
    return {
      valid: false,
      session: null,
      payload: null,
      error: 'Not an admin token'
    }
  }

  // Check if session exists in database and hasn't expired
  const result = await sql`
    SELECT * FROM admin_sessions
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
    session: result[0] as AdminSession,
    payload: jwtResult.payload
  }
}

/**
 * Invalidate a specific admin session (logout)
 * @param token - The session token to invalidate
 */
export async function invalidateAdminSession(token: string): Promise<void> {
  await sql`
    DELETE FROM admin_sessions WHERE token = ${token}
  `
}

/**
 * Invalidate all sessions for an admin
 * @param adminId - The admin ID
 */
export async function invalidateAllAdminSessions(adminId: string): Promise<void> {
  await sql`
    DELETE FROM admin_sessions WHERE admin_id = ${adminId}
  `
}

/**
 * Clean up expired admin sessions from the database
 * Should be run periodically (e.g., via cron job)
 * @returns The number of sessions cleaned up
 */
export async function cleanupExpiredAdminSessions(): Promise<number> {
  const result = await sql`
    DELETE FROM admin_sessions
    WHERE expires_at <= NOW()
    RETURNING id
  `
  return result.length
}

/**
 * Get all active sessions for an admin
 * @param adminId - The admin ID
 * @returns Array of active sessions
 */
export async function getAdminSessions(adminId: string): Promise<AdminSession[]> {
  const result = await sql`
    SELECT * FROM admin_sessions
    WHERE admin_id = ${adminId} AND expires_at > NOW()
    ORDER BY created_at DESC
  `
  return result as AdminSession[]
}

/**
 * Extend a session's expiry time
 * @param token - The session token to extend
 * @param hours - Number of hours to extend (default: 24)
 * @returns The updated session or null
 */
export async function extendAdminSession(
  token: string,
  hours: number = 24
): Promise<AdminSession | null> {
  const newExpiry = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

  const result = await sql`
    UPDATE admin_sessions
    SET expires_at = ${newExpiry}
    WHERE token = ${token} AND expires_at > NOW()
    RETURNING *
  `

  return result.length > 0 ? (result[0] as AdminSession) : null
}

/**
 * Get session count for an admin (for session management UI)
 * @param adminId - The admin ID
 * @returns The number of active sessions
 */
export async function getAdminSessionCount(adminId: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count FROM admin_sessions
    WHERE admin_id = ${adminId} AND expires_at > NOW()
  `
  return parseInt(result[0]?.count || '0', 10)
}
