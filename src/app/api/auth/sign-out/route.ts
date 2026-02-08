/**
 * Sign Out API Route
 *
 * Invalidates the user's session and clears the auth cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { invalidateSession } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    // Get auth token from cookie
    const token = req.cookies.get('auth_token')?.value

    // Invalidate session in database if token exists
    if (token) {
      await invalidateSession(token)
    }

    // Create response and clear cookie
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' })

    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Immediately expire
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Sign out error:', error)
    // Still clear the cookie even if database operation fails
    const response = NextResponse.json({ success: true, message: 'Logged out' })
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })
    return response
  }
}
