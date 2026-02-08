/**
 * Database Migrations
 * Run these to create new tables for admin panel
 */

import { sql } from '@/lib/db'

export async function runMigrations() {
  // First, update existing sessions table token column if it exists
  // Check if sessions table exists and needs updating
  const sessionsTableExists = await sql`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions'
  `

  if (sessionsTableExists.length > 0) {
    // Check if token column is VARCHAR(255)
    const tokenColumn = await sql`
      SELECT data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'token'
    `

    if (tokenColumn.length > 0 && tokenColumn[0]?.character_maximum_length === 255) {
      // Drop the index first (will be recreated)
      await sql`DROP INDEX IF EXISTS idx_sessions_token`
      // Alter the column to TEXT type
      await sql`ALTER TABLE sessions ALTER COLUMN token TYPE TEXT`
      // Recreate the index
      await sql`CREATE INDEX idx_sessions_token ON sessions(token)`
      console.log('Updated sessions table token column to TEXT')
    }
  }

  // Admin Users Table
  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)`

  // Sessions Table (for user authentication)
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`

  // Admin Sessions Table (for admin authentication)
  await sql`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID NOT NULL,
      email VARCHAR(255) NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token)`
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id)`

  console.log('Migrations completed successfully!')
}
