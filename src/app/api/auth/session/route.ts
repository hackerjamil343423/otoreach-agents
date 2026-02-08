/**
 * Session Validation API Route
 *
 * Validates the current user session and returns user data if authenticated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    // Get auth token from cookie
    const token = req.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ user: null, authenticated: false })
    }

    // Validate session using JWT and database
    const sessionResult = await validateSession(token)

    if (!sessionResult.valid || !sessionResult.payload) {
      return NextResponse.json({ user: null, authenticated: false })
    }

    // Get user from database
    const result = await sql`
      SELECT id, email, name, avatar_url
      FROM users
      WHERE id = ${sessionResult.payload.userId}
    `

    if (result.length === 0) {
      return NextResponse.json({ user: null, authenticated: false })
    }

    return NextResponse.json({
      user: result[0],
      authenticated: true,
      expiresAt: sessionResult.session?.expires_at
    })
  } catch (error) {
    console.error('Session validation error:', error)
    return NextResponse.json({ user: null, authenticated: false })
  }
}
