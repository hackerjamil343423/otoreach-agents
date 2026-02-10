/**
 * User Login API Route
 *
 * Authenticates users with email/password and creates a secure JWT session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { isDatabaseConfigured } from '@/lib/db'

export async function POST(req: NextRequest) {
  // Check database configuration first
  if (!isDatabaseConfigured()) {
    console.error('DATABASE_URL environment variable is not set')
    return NextResponse.json(
      { error: 'Database configuration error. Please contact support.' },
      { status: 500 }
    )
  }

  let email: string
  let password: string

  // Parse and validate request body
  try {
    const body = await req.json()
    email = body.email
    password = body.password
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Validate input
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  // Rate limiting could be added here (using IP or email)
  // For now, we'll skip it but it's recommended for production

  try {
    // Find user in our database
    const result = await sql`
      SELECT id, email, name, password_hash
      FROM users
      WHERE email = ${email}
    `

    if (!result || result.length === 0) {
      // Use generic error message to prevent email enumeration
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const user = result[0] as { id: string; email: string; name: string | null; password_hash: string }

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Create JWT session in database
    const session = await createSession(user.id, user.email, 'user')

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      message: 'Login successful'
    })

    // Set HttpOnly cookie with the JWT token
    response.cookies.set('auth_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      {
        error: 'Login failed. Please try again.',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    )
  }
}
