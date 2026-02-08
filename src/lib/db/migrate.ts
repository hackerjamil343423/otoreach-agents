/**
 * Database Migration System
 *
 * Versioned migration system with rollback support.
 * Migrations are tracked in the _migrations table.
 */

import { sql } from '../db'

export interface Migration {
  version: number
  name: string
  up: () => Promise<void>
  down?: () => Promise<void>
}

export interface MigrationRecord {
  version: number
  name: string
  applied_at: Date
}

/**
 * Migration definitions
 * Add new migrations to this array
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async () => {
      // Create admin_users table
      await sql`
        CREATE TABLE IF NOT EXISTS admin_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)`

      // Create agents table
      await sql`
        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          system_prompt TEXT,
          webhook_url TEXT,
          is_active BOOLEAN DEFAULT true,
          user_id UUID,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active)`

      // Create user_agents table
      await sql`
        CREATE TABLE IF NOT EXISTS user_agents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          agent_id UUID NOT NULL,
          is_default BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE (user_id, agent_id)
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_user_agents_user_id ON user_agents(user_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_user_agents_agent_id ON user_agents(agent_id)`
    },
    down: async () => {
      await sql`DROP TABLE IF EXISTS user_agents CASCADE`
      await sql`DROP TABLE IF EXISTS agents CASCADE`
      await sql`DROP TABLE IF EXISTS admin_users CASCADE`
    }
  },
  {
    version: 2,
    name: 'add_sessions_table',
    up: async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          token VARCHAR(500) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`
    },
    down: async () => {
      await sql`DROP TABLE IF EXISTS sessions CASCADE`
    }
  },
  {
    version: 3,
    name: 'add_rate_limits_table',
    up: async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS rate_limits (
          id SERIAL PRIMARY KEY,
          identifier VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_created ON rate_limits(identifier, created_at)`
    },
    down: async () => {
      await sql`DROP TABLE IF EXISTS rate_limits CASCADE`
    }
  },
  {
    version: 4,
    name: 'add_session_id_to_chats',
    up: async () => {
      // Add session_id column if it doesn't exist
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'chats' AND column_name = 'session_id'
          ) THEN
            ALTER TABLE chats ADD COLUMN session_id VARCHAR(255);
          END IF;
        END $$;
      `
    },
    down: async () => {
      // Dropping column is optional - can keep it
    }
  },
  {
    version: 5,
    name: 'simplify_agent_tables',
    up: async () => {
      // Step 1: Add new columns to agents table
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'agents' AND column_name = 'is_global'
          ) THEN
            ALTER TABLE agents ADD COLUMN is_global BOOLEAN DEFAULT true;
          END IF;
        END $$;
      `
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'agents' AND column_name = 'assigned_to'
          ) THEN
            ALTER TABLE agents ADD COLUMN assigned_to UUID[] DEFAULT '{}';
          END IF;
        END $$;
      `

      // Step 2: Migrate existing data - only if user_id column still exists
      // First check if user_id column exists
      const userIdColumnExists = await sql`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agents' AND column_name = 'user_id'
      `

      if (userIdColumnExists.length > 0) {
        // For user-specific agents (user_id IS NOT NULL), mark as not global and assign to that user
        await sql`
          UPDATE agents
          SET
            is_global = false,
            assigned_to = ARRAY[user_id]
          WHERE user_id IS NOT NULL
        `

        // For global agents, populate assigned_to from user_agents table (if it exists)
        const userAgentsTableExists = await sql`
          SELECT 1 FROM information_schema.tables WHERE table_name = 'user_agents'
        `

        if (userAgentsTableExists.length > 0) {
          await sql`
            UPDATE agents
            SET assigned_to = ARRAY(
              SELECT DISTINCT user_id
              FROM user_agents
              WHERE user_agents.agent_id = agents.id
            )
            WHERE is_global = true
          `
        }

        // Step 3: Drop user_id column from agents
        await sql`ALTER TABLE agents DROP COLUMN IF EXISTS user_id`

        // Step 4: Drop user_agents table
        await sql`DROP TABLE IF EXISTS user_agents CASCADE`
      }

      // Step 5: Create index on assigned_to for filtering
      await sql`CREATE INDEX IF NOT EXISTS idx_agents_assigned_to ON agents USING GIN(assigned_to)`
    },
    down: async () => {
      // This migration is difficult to roll back due to data transformation
      // Restore from backup if needed
      throw new Error('Cannot rollback agent table simplification. Please restore from backup.')
    }
  },
  {
    version: 6,
    name: 'projects_feature',
    up: async () => {
      // User's Supabase configuration (encrypted)
      await sql`
        CREATE TABLE IF NOT EXISTS user_supabase_config (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          supabase_url JSONB NOT NULL,
          supabase_anon_key JSONB NOT NULL,
          project_bucket_name TEXT DEFAULT 'projects',
          is_configured BOOLEAN DEFAULT FALSE,
          last_verified_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_user_supabase_config_user_id ON user_supabase_config(user_id)`

      // Main projects
      await sql`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(50) DEFAULT 'folder',
          color VARCHAR(7) DEFAULT '#3b82f6',
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`

      // Sub-projects
      await sql`
        CREATE TABLE IF NOT EXISTS sub_projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(50) DEFAULT 'folder',
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_sub_projects_project_id ON sub_projects(project_id)`

      // Project files (metadata only, content in Supabase)
      await sql`
        CREATE TABLE IF NOT EXISTS project_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sub_project_id UUID NOT NULL REFERENCES sub_projects(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          file_type VARCHAR(50) DEFAULT 'text',
          supabase_storage_path TEXT NOT NULL,
          size_bytes INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_project_files_sub_project_id ON project_files(sub_project_id)`

      // Link chats to projects
      await sql`
        CREATE TABLE IF NOT EXISTS chat_project_links (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(chat_id, project_id)
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_chat_project_links_chat_id ON chat_project_links(chat_id)`
      await sql`CREATE INDEX IF NOT EXISTS idx_chat_project_links_project_id ON chat_project_links(project_id)`
    },
    down: async () => {
      await sql`DROP TABLE IF EXISTS chat_project_links CASCADE`
      await sql`DROP TABLE IF EXISTS project_files CASCADE`
      await sql`DROP TABLE IF EXISTS sub_projects CASCADE`
      await sql`DROP TABLE IF EXISTS projects CASCADE`
      await sql`DROP TABLE IF EXISTS user_supabase_config CASCADE`
    }
  },
  {
    version: 7,
    name: 'add_service_role_secret',
    up: async () => {
      // Add service_role_secret column for admin-level Supabase access
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_supabase_config' AND column_name = 'service_role_secret'
          ) THEN
            ALTER TABLE user_supabase_config ADD COLUMN service_role_secret JSONB;
          END IF;
        END $$;
      `

      // Add use_service_role flag to determine which key to use
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_supabase_config' AND column_name = 'use_service_role'
          ) THEN
            ALTER TABLE user_supabase_config ADD COLUMN use_service_role BOOLEAN DEFAULT FALSE;
          END IF;
        END $$;
      `

      // Add schema_initialized flag to track if user Supabase tables are set up
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'user_supabase_config' AND column_name = 'schema_initialized'
          ) THEN
            ALTER TABLE user_supabase_config ADD COLUMN schema_initialized BOOLEAN DEFAULT FALSE;
          END IF;
        END $$;
      `
    },
    down: async () => {
      await sql`ALTER TABLE user_supabase_config DROP COLUMN IF EXISTS service_role_secret`
      await sql`ALTER TABLE user_supabase_config DROP COLUMN IF EXISTS use_service_role`
      await sql`ALTER TABLE user_supabase_config DROP COLUMN IF EXISTS schema_initialized`
    }
  },
  {
    version: 8,
    name: 'add_file_description',
    up: async () => {
      // Add description column to project_files
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'project_files' AND column_name = 'description'
          ) THEN
            ALTER TABLE project_files ADD COLUMN description TEXT;
          END IF;
        END $$;
      `
    },
    down: async () => {
      await sql`ALTER TABLE project_files DROP COLUMN IF EXISTS description`
    }
  },
  {
    version: 9,
    name: 'add_user_webhook_url',
    up: async () => {
      // Add webhook_url column to users table for per-user webhook configuration
      await sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'webhook_url'
          ) THEN
            ALTER TABLE users ADD COLUMN webhook_url TEXT;
          END IF;
        END $$;
      `
    },
    down: async () => {
      await sql`ALTER TABLE users DROP COLUMN IF EXISTS webhook_url`
    }
  }
]

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `
}

/**
 * Get current migration version from database
 */
async function getCurrentVersion(): Promise<number> {
  const result = await sql`
    SELECT COALESCE(MAX(version), 0) as v FROM _migrations
  `
  return parseInt(result[0]?.v || '0', 10)
}

/**
 * Get applied migrations
 */
async function getAppliedMigrations(): Promise<MigrationRecord[]> {
  const result = await sql`
    SELECT version, name, applied_at FROM _migrations ORDER BY version
  `
  return result as MigrationRecord[]
}

/**
 * Run pending migrations (up)
 *
 * @param targetVersion - Optional target version (migrates to latest if not specified)
 */
export async function runMigrations(targetVersion?: number): Promise<void> {
  await ensureMigrationsTable()

  const currentVersion = await getCurrentVersion()
  const lastMigration = migrations[migrations.length - 1]
  const maxVersion = targetVersion ?? lastMigration?.version ?? 0

  console.log(`Current migration version: ${currentVersion}`)
  console.log(`Target migration version: ${maxVersion}`)

  for (const migration of migrations) {
    if (migration.version > currentVersion && migration.version <= maxVersion) {
      console.log(`Running migration ${migration.version}: ${migration.name}`)
      try {
        await migration.up()
        await sql`
          INSERT INTO _migrations (version, name)
          VALUES (${migration.version}, ${migration.name})
        `
        console.log(`✓ Migration ${migration.version} completed`)
      } catch (error) {
        console.error(`✗ Migration ${migration.version} failed:`, error)
        throw error
      }
    }
  }

  console.log('All migrations completed successfully')
}

/**
 * Rollback migrations (down)
 *
 * @param targetVersion - Target version to rollback to
 */
export async function rollbackMigrations(targetVersion: number): Promise<void> {
  const currentVersion = await getCurrentVersion()

  if (targetVersion >= currentVersion) {
    console.log('No rollback needed - target version is not lower than current version')
    return
  }

  console.log(`Rolling back from version ${currentVersion} to ${targetVersion}`)

  // Get migrations in reverse order
  const reversedMigrations = [...migrations].reverse()

  for (const migration of reversedMigrations) {
    if (migration.version > targetVersion && migration.version <= currentVersion) {
      if (!migration.down) {
        console.log(`⚠ Migration ${migration.version} has no rollback defined, skipping`)
        continue
      }

      console.log(`Rolling back migration ${migration.version}: ${migration.name}`)
      try {
        await migration.down()
        await sql`DELETE FROM _migrations WHERE version = ${migration.version}`
        console.log(`✓ Rollback ${migration.version} completed`)
      } catch (error) {
        console.error(`✗ Rollback ${migration.version} failed:`, error)
        throw error
      }
    }
  }

  console.log('Rollback completed successfully')
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<{
  current: number
  applied: MigrationRecord[]
  pending: Array<{ version: number; name: string }>
}> {
  await ensureMigrationsTable()

  const current = await getCurrentVersion()
  const applied = await getAppliedMigrations()

  const pending = migrations
    .filter((m) => m.version > current)
    .map((m) => ({ version: m.version, name: m.name }))

  return { current, applied, pending }
}

/**
 * Run migrations from HTTP endpoint
 * This is the function called by /api/db/migrate
 */
export async function migrateFromAPI(): Promise<{
  success: boolean
  message: string
  status?: {
    current: number
    applied: MigrationRecord[]
    pending: { version: number; name: string }[]
  }
}> {
  try {
    await runMigrations()
    const status = await getMigrationStatus()
    return {
      success: true,
      message: 'Migrations completed successfully',
      status
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Migration failed'
    }
  }
}
