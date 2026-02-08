/**
 * User Login API Route
 *
 * Authenticates users with email/password and creates a secure JWT session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

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

    const user = result[0]

    if (!user) {
      // Use generic error message to prevent email enumeration
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
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      {
        error: 'Login failed. Please try again.',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
