/**
 * Authentication Helper Functions
 *
 * Traditional email/password authentication functions.
 * Neon Auth OAuth functions have been removed as we use email/password only.
 */

import { sql } from '@/lib/db'

export interface User {
  id: string
  email: string
  name: string | null
}

/**
 * Get current user from email (for traditional auth)
 */
export async function getCurrentUser(email: string | null): Promise<User | null> {
  if (!email) {
    return null
  }

  const user = await sql`
    SELECT id, email, name
    FROM users
    WHERE email = ${email}
  `

  if (!user || user.length === 0) {
    return null
  }

  const userData = user[0]!
  return {
    id: userData.id,
    email: userData.email,
    name: userData.name
  }
}

/**
 * Verify user password (traditional auth)
 */
export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const user = await sql`
    SELECT id, email, password_hash, name
    FROM users
    WHERE email = ${email}
  `

  if (!user || user.length === 0) {
    return null
  }

  const userData = user[0]!
  const bcrypt = await import('bcryptjs')
  const isValid = await bcrypt.compare(password, userData.password_hash)

  if (!isValid) {
    return null
  }

  return {
    id: userData.id,
    email: userData.email,
    name: userData.name
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const user = await sql`
    SELECT id, email, name
    FROM users
    WHERE id = ${userId}
  `

  if (!user || user.length === 0) {
    return null
  }

  const userData = user[0]!
  return {
    id: userData.id,
    email: userData.email,
    name: userData.name
  }
}
