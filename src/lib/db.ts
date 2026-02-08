/**
 * Neon Database Connection
 *
 * This file sets up the Neon database connection using @neondatabase/serverless
 * which provides a serverless PostgreSQL client optimized for Neon.
 */

import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

/**
 * Neon SQL instance for executing queries
 * Use this for all database operations
 */
export const sql = neon(process.env.DATABASE_URL)
