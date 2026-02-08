/**
 * Admin Authentication API Route
 *
 * Handles admin login, logout, session validation, and admin creation.
 * Uses database-backed JWT sessions for security.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createAdminSession,
  invalidateAdminSession,
  validateAdminSession
} from '@/lib/auth/admin-session'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

// POST /api/admin/auth - Login, logout, or create admin
export async function POST(req: NextRequest) {
  try {
    const { action, email, password, name } = await req.json()

    if (action === 'login') {
      // Admin login
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }

      // Get admin user
      const result =
        await sql`SELECT * FROM admin_users WHERE email = ${email} AND is_active = true`
      const admin = result[0]

      if (!admin) {
        // Use generic error message to prevent admin email enumeration
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      // Verify password
      const isValid = await bcrypt.compare(password, admin.password_hash)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      // Create JWT session in database for admin
      const session = await createAdminSession(admin.id, admin.email)

      // Create response with admin session cookie
      const response = NextResponse.json({
        success: true,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        }
      })

      // Set HttpOnly cookie with the JWT token
      response.cookies.set('admin_session', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/'
      })

      return response
    }

    if (action === 'create') {
      // Create new admin (only if no admin exists yet)
      const existingAdmins = await sql`SELECT COUNT(*) as count FROM admin_users`
      const adminCount = existingAdmins[0] ? parseInt(existingAdmins[0].count || '0') : 0
      if (adminCount > 0) {
        return NextResponse.json(
          { error: 'Admin already exists. Use login action.' },
          { status: 400 }
        )
      }

      if (!email || !password || !name) {
        return NextResponse.json(
          { error: 'Email, password, and name are required' },
          { status: 400 }
        )
      }

      // Validate password strength (min 8 characters)
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters long' },
          { status: 400 }
        )
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10)

      // Create admin
      const result = await sql`
        INSERT INTO admin_users (id, email, password_hash, name, is_active)
        VALUES (${uuid()}, ${email}, ${password_hash}, ${name}, true)
        RETURNING id, email, name
      `

      return NextResponse.json({
        success: true,
        user: result[0]
      })
    }

    if (action === 'logout') {
      // Get session token from cookie
      const token = req.cookies.get('admin_session')?.value

      // Invalidate session in database if token exists
      if (token) {
        await invalidateAdminSession(token)
      }

      // Create response and clear cookie
      const response = NextResponse.json({ success: true })
      response.cookies.set('admin_session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      })

      return response
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Admin auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}

// GET /api/admin/auth - Check session
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('admin_session')?.value

    if (!token) {
      return NextResponse.json({ authenticated: false })
    }

    // Validate session using JWT and database
    const sessionResult = await validateAdminSession(token)

    if (!sessionResult.valid || !sessionResult.payload || sessionResult.payload.type !== 'admin') {
      return NextResponse.json({ authenticated: false })
    }

    // Get admin details
    const result =
      await sql`SELECT id, email, name FROM admin_users WHERE id = ${sessionResult.payload!.userId}`
    const admin = result[0]

    if (!admin) {
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      },
      expiresAt: sessionResult.session?.expires_at
    })
  } catch (error) {
    console.error('Admin session check error:', error)
    return NextResponse.json({ authenticated: false })
  }
}
