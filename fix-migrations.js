/**
 * Fix Database Migrations
 *
 * Run this with: node fix-migrations.js
 */

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log('Checking database state...\n')

  try {
    // Check if _migrations table exists
    const migrationsTable = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_name = '_migrations'
    `
    console.log('_migrations table exists:', migrationsTable.length > 0)

    if (migrationsTable.length > 0) {
      const applied = await sql`SELECT version, name, applied_at FROM _migrations ORDER BY version`
      console.log('Applied migrations:', applied)
    }

    // Check sessions table
    const sessionsTable = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'sessions'
    `
    console.log('\nsessions table exists:', sessionsTable.length > 0)

    // Check users table structure
    const usersColumns = await sql`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'
    `
    console.log('\nusers table columns:', usersColumns.map((c) => c.column_name).join(', '))

    // Check agents table structure
    const agentsColumns = await sql`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agents'
    `
    console.log('\nagents table columns:', agentsColumns.map((c) => c.column_name).join(', '))

    // Check if sessions table needs to be created
    if (sessionsTable.length === 0) {
      console.log('\nCreating sessions table...')
      await sql`
        CREATE TABLE sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          token VARCHAR(500) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX idx_sessions_user_id ON sessions(user_id)`
      await sql`CREATE INDEX idx_sessions_token ON sessions(token)`
      await sql`CREATE INDEX idx_sessions_expires_at ON sessions(expires_at)`
      console.log('✓ sessions table created')
    }

    // Check if agents table has is_global and assigned_to columns
    const hasIsGlobal = agentsColumns.some((c) => c.column_name === 'is_global')
    const hasAssignedTo = agentsColumns.some((c) => c.column_name === 'assigned_to')
    const hasUserId = agentsColumns.some((c) => c.column_name === 'user_id')

    console.log(
      '\nagents table - has is_global:',
      hasIsGlobal,
      'has assigned_to:',
      hasAssignedTo,
      'has user_id:',
      hasUserId
    )

    // Update migration records
    if (migrationsTable.length > 0) {
      // Mark migration 2 as applied if sessions table exists
      if (sessionsTable.length > 0) {
        const hasMigration2 = await sql`SELECT version FROM _migrations WHERE version = 2`
        if (hasMigration2.length === 0) {
          await sql`INSERT INTO _migrations (version, name) VALUES (2, 'add_sessions_table')`
          console.log('✓ Migration 2 marked as applied')
        }
      }

      // Mark migration 3 as applied
      const hasMigration3 = await sql`SELECT version FROM _migrations WHERE version = 3`
      if (hasMigration3.length === 0) {
        await sql`INSERT INTO _migrations (version, name) VALUES (3, 'add_rate_limits_table')`
        console.log('✓ Migration 3 marked as applied')
      }

      // Mark migration 4 as applied
      const hasMigration4 = await sql`SELECT version FROM _migrations WHERE version = 4`
      if (hasMigration4.length === 0) {
        await sql`INSERT INTO _migrations (version, name) VALUES (4, 'add_session_id_to_chats')`
        console.log('✓ Migration 4 marked as applied')
      }

      // Mark migration 5 as applied if agents table is already migrated
      if (hasIsGlobal && hasAssignedTo && !hasUserId) {
        const hasMigration5 = await sql`SELECT version FROM _migrations WHERE version = 5`
        if (hasMigration5.length === 0) {
          await sql`INSERT INTO _migrations (version, name) VALUES (5, 'simplify_agent_tables')`
          console.log('✓ Migration 5 marked as applied')
        }
      }
    }

    console.log('\n✓ Migration fix completed successfully!')
    console.log('\nCurrent state:')
    const finalApplied =
      await sql`SELECT version, name, applied_at FROM _migrations ORDER BY version`
    console.log('Applied migrations:', finalApplied)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
