/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Generates and validates CSRF tokens for state-changing operations.
 * Edge Runtime compatible.
 */

import { cookies } from 'next/headers'

const CSRF_SECRET =
  process.env.CSRF_SECRET ||
  (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CSRF_SECRET environment variable must be set in production')
    }
    // Development fallback
    return 'dev-csrf-secret-change-in-production-min-32'
  })()
const CSRF_TOKEN_EXPIRY = 3600 // 1 hour in seconds

/**
 * Generate random string for CSRF token
 * Compatible with both Edge and Node.js runtimes
 */
function generateRandomToken(): string {
  // Use Web Crypto API when available (Edge Runtime compatible)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    // Convert to base64url
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }
  // Fallback for Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(Math.random().toString()).toString('base64')
  }
  // Last resort fallback
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * Simple timing-safe string comparison
 * For CSRF tokens, exact match is required
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  // Simple constant-time comparison
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

export interface CsrfTokenResult {
  token: string
  expiresAt: Date
}

/**
 * Generate a new CSRF token and store it in a cookie
 *
 * @returns The CSRF token and expiry time
 */
export async function generateCsrfToken(): Promise<string> {
  // Generate random token
  const token = generateRandomToken()

  // Store token in HttpOnly cookie
  const cookieStore = await cookies()
  cookieStore.set('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY,
    path: '/'
  })

  return token
}

/**
 * Validate a CSRF token against the stored cookie
 *
 * @param token - The CSRF token to validate
 * @returns true if valid, false otherwise
 */
export async function validateCsrfToken(token: string): Promise<boolean> {
  const cookieStore = await cookies()
  const storedToken = cookieStore.get('csrf_token')?.value

  if (!storedToken || !token) {
    return false
  }

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(storedToken, token)
}

/**
 * Get the current CSRF token from cookie without generating a new one
 *
 * @returns The stored CSRF token or null
 */
export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('csrf_token')?.value || null
}

/**
 * Clear the CSRF token from cookies
 */
export async function clearCsrfToken(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('csrf_token')
}

/**
 * Generate a CSRF token hash for use in forms
 * This creates a double-submit cookie pattern
 *
 * @returns The hashed CSRF token
 */
export async function generateCsrfHash(): Promise<string> {
  const token = await generateCsrfToken()

  // Simple hash using the secret (not cryptographically secure but sufficient for CSRF)
  const hash = btoa(token + CSRF_SECRET)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return hash
}

/**
 * Validate a CSRF token hash against the stored cookie
 *
 * @param hash - The hashed CSRF token to validate
 * @returns true if valid, false otherwise
 */
export async function validateCsrfHash(hash: string): Promise<boolean> {
  const storedToken = await getCsrfToken()

  if (!storedToken || !hash) {
    return false
  }

  const expectedHash = btoa(storedToken + CSRF_SECRET)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return timingSafeEqual(hash, expectedHash)
}

/**
 * Middleware helper to validate CSRF token for API routes
 * Returns an error response if validation fails
 *
 * @param request - The NextRequest object
 * @returns null if valid, error Response if invalid
 */
export async function requireCsrfValidation(request: Request): Promise<Response | null> {
  // Skip CSRF for GET, HEAD, OPTIONS requests (read-only)
  const method = request.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return null
  }

  // Get CSRF token from header or form data
  const csrfToken = request.headers.get('x-csrf-token')

  if (!csrfToken) {
    return new Response(JSON.stringify({ error: 'CSRF token missing' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const isValid = await validateCsrfToken(csrfToken)

  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return null
}
