/**
 * User Authentication Middleware
 *
 * Validates user sessions for protected user routes.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'

// Paths that require user authentication
const protectedPaths = ['/chat', '/settings']
const publicPaths = ['/login', '/register', '/api/auth', '/api/chat']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if this is a protected path
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path))

  // Allow public paths
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))
  if (isPublicPath) {
    return NextResponse.next()
  }

  // Skip middleware for static files, API routes that handle their own auth, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/user'))
  ) {
    return NextResponse.next()
  }

  // Only authenticate protected paths
  if (!isProtectedPath) {
    return NextResponse.next()
  }

  // Get user session token
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    // Redirect to login if no session
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify JWT token
  const tokenResult = verifyToken(token)

  if (!tokenResult.valid || !tokenResult.payload || tokenResult.payload.type !== 'user') {
    // Redirect to login if token is invalid
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Token is valid, allow request to proceed
  // API routes will do additional database validation if needed
  return NextResponse.next()
}

export const config = {
  matcher: ['/chat/:path*', '/settings/:path*']
}
