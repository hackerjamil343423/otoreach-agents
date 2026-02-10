import jwt from 'jsonwebtoken'

// Get JWT_SECRET lazily when needed (not at module load time)
// This prevents build-time errors when JWT_SECRET is not set
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) {
    return secret
  }
  // Only throw in production if no secret is set
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production. Please add it in your Vercel project settings.')
  }
  // Development fallback - should NOT be used in production
  return 'dev-secret-key-change-in-production-min-32-chars'
}

export interface TokenPayload {
  userId: string
  email: string
  type: 'user' | 'admin'
  iat?: number
  exp?: number
}

export interface TokenValidationResult {
  valid: boolean
  payload: TokenPayload | null
  error?: string
}

/**
 * Generate a JWT token for a user or admin
 * @param payload - The token payload containing userId, email, and type
 * @returns The signed JWT token
 */
export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '24h', // Token expires in 24 hours
    issuer: 'oto-reach-agents',
    audience: 'oto-reach-agents-users'
  })
}

/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @returns The token validation result with payload or error
 */
export function verifyToken(token: string): TokenValidationResult {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'oto-reach-agents',
      audience: 'oto-reach-agents-users'
    }) as TokenPayload

    return {
      valid: true,
      payload: decoded
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        payload: null,
        error: 'Token expired'
      }
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        payload: null,
        error: 'Invalid token'
      }
    }
    return {
      valid: false,
      payload: null,
      error: 'Unknown error'
    }
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - The Authorization header value
 * @returns The token string or null
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null

  // Support both "Bearer <token>" and direct token formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return authHeader
}

/**
 * Decode token without verification (for debugging/logging only)
 * @param token - The JWT token to decode
 * @returns The decoded payload or null
 */
export function decodeTokenWithoutVerification(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload
  } catch {
    return null
  }
}

/**
 * Get the time until token expires
 * @param token - The JWT token
 * @returns The time until expiry in seconds, or null if invalid
 */
export function getTokenExpiresIn(token: string): number | null {
  const decoded = decodeTokenWithoutVerification(token)
  if (!decoded || !decoded.exp) return null

  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, decoded.exp - now)
}
