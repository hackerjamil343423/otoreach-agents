/**
 * Rate Limiting System
 *
 * Prevents abuse by limiting the number of requests from a single identifier.
 * Uses database-backed storage for persistence across server restarts.
 */

import { sql } from '@/lib/db'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt?: Date
  error?: string
}

/**
 * Check if a request is within rate limits
 *
 * @param identifier - Unique identifier (IP address, user ID, email, etc.)
 * @param limit - Maximum number of requests allowed in the time window
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns Rate limit result
 */
export async function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): Promise<RateLimitResult> {
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    // Clean old entries outside the current window
    await sql`
      DELETE FROM rate_limits
      WHERE identifier = ${key}
        AND created_at < ${new Date(windowStart).toISOString()}
    `

    // Count current requests in the window
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM rate_limits
      WHERE identifier = ${key}
        AND created_at >= ${new Date(windowStart).toISOString()}
    `

    const current = parseInt(countResult[0]?.count || '0', 10)

    if (current >= limit) {
      // Get the oldest request time for reset calculation
      const oldestResult = await sql`
        SELECT MIN(created_at) as oldest_time
        FROM rate_limits
        WHERE identifier = ${key}
          AND created_at >= ${new Date(windowStart).toISOString()}
      `

      const resetAt = oldestResult[0]?.oldest_time
        ? new Date(new Date(oldestResult[0].oldest_time).getTime() + windowMs)
        : new Date(now + windowMs)

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        error: 'Rate limit exceeded'
      }
    }

    // Add current request
    await sql`
      INSERT INTO rate_limits (identifier, created_at)
      VALUES (${key}, ${new Date().toISOString()})
    `

    return {
      allowed: true,
      remaining: limit - current - 1
    }
  } catch (error) {
    console.error('Rate limit error:', error)
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      remaining: limit,
      error: undefined
    }
  }
}

/**
 * Reset rate limit for an identifier (for admin use)
 *
 * @param identifier - Unique identifier to reset
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const key = `rate_limit:${identifier}`
  await sql`DELETE FROM rate_limits WHERE identifier = ${key}`
}

/**
 * Get current rate limit status without incrementing
 *
 * @param identifier - Unique identifier
 * @param limit - Maximum number of requests
 * @param windowMs - Time window in milliseconds
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<{ count: number; remaining: number; resetAt?: Date }> {
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  const windowStart = now - windowMs

  const countResult = await sql`
    SELECT COUNT(*) as count, MIN(created_at) as oldest_time
    FROM rate_limits
    WHERE identifier = ${key}
      AND created_at >= ${new Date(windowStart).toISOString()}
  `

  const count = parseInt(countResult[0]?.count || '0', 10)
  const resetAt = countResult[0]?.oldest_time
    ? new Date(new Date(countResult[0].oldest_time).getTime() + windowMs)
    : undefined

  return {
    count,
    remaining: Math.max(0, limit - count),
    resetAt
  }
}

/**
 * Clean up expired rate limit entries
 * Should be run periodically (e.g., via cron job)
 *
 * @returns Number of entries cleaned up
 */
export async function cleanupRateLimits(): Promise<number> {
  const result = await sql`
    DELETE FROM rate_limits
    WHERE created_at < NOW() - INTERVAL '1 hour'
    RETURNING id
  `
  return result.length
}
