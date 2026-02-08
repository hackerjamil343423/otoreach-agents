/**
 * Admin Authentication Middleware
 *
 * Validates admin sessions for protected admin routes.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'

const publicAdminPaths = ['/admin/login', '/admin/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only check admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Allow public admin paths
  for (const path of publicAdminPaths) {
    if (pathname.startsWith(path)) {
      return NextResponse.next()
    }
  }

  // Get admin session token
  const token = request.cookies.get('admin_session')?.value

  if (!token) {
    // Redirect to login if no session
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify JWT token
  const tokenResult = verifyToken(token)

  if (!tokenResult.valid || !tokenResult.payload || tokenResult.payload.type !== 'admin') {
    // Redirect to login if token is invalid
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Token is valid, allow request to proceed
  // API routes will do additional database validation
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*'
}
