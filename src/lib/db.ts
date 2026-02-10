/**
 * Neon Database Connection
 *
 * This file sets up the Neon database connection using @neondatabase/serverless
 * which provides a serverless PostgreSQL client optimized for Neon.
 */

import { neon, neonConfig } from '@neondatabase/serverless'

// Configure connection pooling for serverless environments
neonConfig.fetchConnectionCache = true

/**
 * Get DATABASE_URL from environment with validation
 * Returns null if not set (for graceful error handling)
 */
function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL
  if (!url) {
    // Log error in production but don't throw at module level
    if (process.env.NODE_ENV === 'production') {
      console.error('DATABASE_URL environment variable is not set')
    }
    return null
  }
  return url
}

const databaseUrl = getDatabaseUrl()

/**
 * Neon SQL instance for executing queries
 * Use this for all database operations
 *
 * Note: If DATABASE_URL is not set, sql will be a no-op function
 * that logs errors. This prevents app crashes during development.
 */
export const sql = databaseUrl
  ? neon(databaseUrl, {
    fetchOptions: {
      cache: 'no-store'
    }
  })
  : (() => {
      // Create a no-op sql function that logs errors
      const noopSql = async (...args: unknown[]) => {
        console.error('Database not configured. Please set DATABASE_URL environment variable.')
        return []
      }
      // Add properties that might be accessed
      noopSql.unsafe = noopSql as any
      return noopSql as any
    })()

/**
 * Check if database is properly configured
 */
export function isDatabaseConfigured(): boolean {
  return !!databaseUrl
}
