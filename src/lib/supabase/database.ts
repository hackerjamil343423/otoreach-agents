/**
 * User Supabase Database Management
 * 
 * These functions manage tables in the user's own Supabase project.
 * Uses service role key for full database access.
 */

import { createSupabaseAdminClient } from './client'
import { sql } from '../db'

export interface TableColumn {
  name: string
  type: string
  nullable?: boolean
  defaultValue?: string
  isPrimary?: boolean
}

export interface TableSchema {
  name: string
  columns: TableColumn[]
  indexes?: string[]
}

/**
 * SQL to create the required tables in user's Supabase
 * Run this to initialize the user's database for OTO Reach integration
 * 
 * NOTE: document_metadata table is managed by the user themselves
 * and should be created separately. See DOCUMENT_METADATA_TABLE_SQL.
 */
export const USER_SUPABASE_SETUP_SQL = `
-- =====================================================
-- OTO Reach Agents - User Supabase Setup
-- Run this SQL in your Supabase SQL Editor to enable full integration
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Core Tables
-- =====================================================

-- Chat sessions stored in user's Supabase
CREATE TABLE IF NOT EXISTS oto_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT 'New Chat',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages stored in user's Supabase
CREATE TABLE IF NOT EXISTS oto_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES oto_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects stored in user's Supabase (synced from Neon)
CREATE TABLE IF NOT EXISTS oto_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id UUID, -- Reference to Neon project ID
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#3b82f6',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sub-projects stored in user's Supabase
CREATE TABLE IF NOT EXISTS oto_sub_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id UUID, -- Reference to Neon sub-project ID
  project_id UUID NOT NULL REFERENCES oto_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Files stored in user's Supabase (content in storage, metadata here)
CREATE TABLE IF NOT EXISTS oto_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id UUID, -- Reference to Neon file ID
  sub_project_id UUID REFERENCES oto_sub_projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_type TEXT DEFAULT 'text',
  storage_path TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom data tables - for user-defined entities
CREATE TABLE IF NOT EXISTS oto_custom_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_oto_messages_chat_id ON oto_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_oto_messages_created_at ON oto_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_oto_sub_projects_project_id ON oto_sub_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_oto_files_sub_project_id ON oto_files(sub_project_id);
CREATE INDEX IF NOT EXISTS idx_oto_files_storage_path ON oto_files(storage_path);
CREATE INDEX IF NOT EXISTS idx_oto_custom_entities_type ON oto_custom_entities(entity_type);

-- =====================================================
-- Storage Bucket Setup (if not exists)
-- =====================================================

-- Note: Buckets are created via API, not SQL
-- The application will create the 'projects' bucket automatically

-- =====================================================
-- Functions
-- =====================================================

-- Function to get schema names (for testing connection)
CREATE OR REPLACE FUNCTION get_schema_names()
RETURNS TABLE(schema_name text) AS $$
BEGIN
  RETURN QUERY SELECT nspname::text FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DOCUMENT METADATA TABLE (User-managed)
-- =====================================================
-- This table is created by the user themselves
-- It's used for the file selector in chat

/*
CREATE TABLE IF NOT EXISTS document_metadata (
    id TEXT PRIMARY KEY,
    title TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    schema TEXT,
    project_id TEXT,        -- Links to project (optional)
    sub_project_id TEXT,    -- Links to sub-project (optional)
    source TEXT             -- 'upload', 'project', 'chat', 'import'
);

CREATE INDEX IF NOT EXISTS idx_document_metadata_project_id ON document_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_document_metadata_sub_project_id ON document_metadata(sub_project_id);
*/

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_oto_chats_updated_at ON oto_chats;
CREATE TRIGGER update_oto_chats_updated_at
  BEFORE UPDATE ON oto_chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oto_projects_updated_at ON oto_projects;
CREATE TRIGGER update_oto_projects_updated_at
  BEFORE UPDATE ON oto_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oto_sub_projects_updated_at ON oto_sub_projects;
CREATE TRIGGER update_oto_sub_projects_updated_at
  BEFORE UPDATE ON oto_sub_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oto_files_updated_at ON oto_files;
CREATE TRIGGER update_oto_files_updated_at
  BEFORE UPDATE ON oto_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oto_custom_entities_updated_at ON oto_custom_entities;
CREATE TRIGGER update_oto_custom_entities_updated_at
  BEFORE UPDATE ON oto_custom_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`

/**
 * Initialize the user's Supabase with required tables
 * Creates all necessary tables for OTO Reach integration
 */
export async function initializeUserSupabase(userId: string): Promise<{
  success: boolean
  error?: string
  createdTables?: string[]
}> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    // Execute the setup SQL
    // Note: Supabase JS client doesn't support multi-statement SQL execution
    // We need to execute statements one by one or use a different approach

    const statements = USER_SUPABASE_SETUP_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    const createdTables: string[] = []
    const errors: string[] = []

    for (const statement of statements) {
      try {
        // Skip CREATE EXTENSION (requires superuser)
        if (statement.toLowerCase().includes('create extension')) {
          continue
        }

        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        
        if (error) {
          // Some statements might fail if objects already exist, which is fine
          if (!error.message.includes('already exists')) {
            errors.push(`${statement.substring(0, 50)}...: ${error.message}`)
          }
        }

        // Track created tables
        const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i)
        if (tableMatch && tableMatch[1]) {
          createdTables.push(tableMatch[1])
        }
      } catch (err) {
        errors.push(`${statement.substring(0, 50)}...: ${err}`)
      }
    }

    // Alternative: Use Supabase's REST API to create tables individually
    // This is a simplified approach - in production, you might want to use
    // a more robust method like a Supabase Edge Function

    // Update the schema_initialized flag
    await sql`
      UPDATE user_supabase_config
      SET schema_initialized = TRUE
      WHERE user_id = ${userId}
    `

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      createdTables
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize Supabase'
    }
  }
}

/**
 * Check if user's Supabase has the required tables
 */
export async function checkUserSupabaseSchema(userId: string): Promise<{
  initialized: boolean
  existingTables: string[]
  missingTables: string[]
}> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    const requiredTables = [
      'oto_chats',
      'oto_messages',
      'oto_projects',
      'oto_sub_projects',
      'oto_files',
      'oto_custom_entities'
    ]

    const existingTables: string[] = []

    for (const table of requiredTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })

        if (!error) {
          existingTables.push(table)
        }
      } catch {
        // Table doesn't exist
      }
    }

    const missingTables = requiredTables.filter(t => !existingTables.includes(t))

    return {
      initialized: missingTables.length === 0,
      existingTables,
      missingTables
    }
  } catch {
    return {
      initialized: false,
      existingTables: [],
      missingTables: [
        'oto_chats',
        'oto_messages',
        'oto_projects',
        'oto_sub_projects',
        'oto_files',
        'oto_custom_entities'
      ]
    }
  }
}

/**
 * Sync a project from Neon to user's Supabase
 */
export async function syncProjectToUserSupabase(
  userId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    // Get project from Neon
    const projectResult = await sql`
      SELECT * FROM projects WHERE id = ${projectId}
    `

    if (projectResult.length === 0) {
      return { success: false, error: 'Project not found' }
    }

    const project = projectResult[0] as {
      name: string
      description: string | null
      icon: string
      color: string
      sort_order: number
      created_at: Date
      updated_at: Date
    }

    // Upsert to user's Supabase
    const { error } = await supabase
      .from('oto_projects')
      .upsert({
        external_id: projectId,
        name: project.name,
        description: project.description,
        icon: project.icon,
        color: project.color,
        metadata: {
          sort_order: project.sort_order,
          source: 'oto_reach'
        },
        created_at: project.created_at,
        updated_at: project.updated_at
      }, {
        onConflict: 'external_id'
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    }
  }
}

/**
 * Execute a custom query on user's Supabase
 * Use with caution - allows any SQL to be executed
 */
export async function executeUserSupabaseQuery<T = unknown>(
  userId: string,
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete',
  data?: Record<string, unknown>,
  filters?: Record<string, unknown>
): Promise<{ success: boolean; data?: T[]; error?: string; count?: number }> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    if (operation === 'select') {
      let query = supabase.from(table).select('*')
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      const { data: result, error, count } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data: (result ?? []) as T[], count: count ?? undefined }
    }

    if (operation === 'insert') {
      const { data: result, error, count } = await supabase
        .from(table)
        .insert(data)
        .select()
      if (error) return { success: false, error: error.message }
      return { success: true, data: (result ?? []) as T[], count: count ?? undefined }
    }

    if (operation === 'update') {
      let query = supabase.from(table).update(data || {})
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      const { data: result, error, count } = await query.select()
      if (error) return { success: false, error: error.message }
      return { success: true, data: result as T[], count: count ?? undefined }
    }

    if (operation === 'delete') {
      let query = supabase.from(table).delete()
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      const { data: result, error, count } = await query
      if (error) return { success: false, error: error.message }
      return { success: true, data: (result ?? []) as T[], count: count ?? undefined }
    }

    return { success: false, error: 'Invalid operation' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Query failed'
    }
  }
}

/**
 * Get user's Supabase connection info
 */
export async function getUserSupabaseInfo(userId: string): Promise<{
  configured: boolean
  hasServiceRole: boolean
  useServiceRole: boolean
  schemaInitialized: boolean
}> {
  const result = await sql`
    SELECT 
      is_configured,
      service_role_secret IS NOT NULL as has_service_role,
      use_service_role,
      schema_initialized
    FROM user_supabase_config
    WHERE user_id = ${userId}
  `

  if (result.length === 0) {
    return {
      configured: false,
      hasServiceRole: false,
      useServiceRole: false,
      schemaInitialized: false
    }
  }

  return {
    configured: result[0]?.is_configured === true,
    hasServiceRole: result[0]?.has_service_role === true,
    useServiceRole: result[0]?.use_service_role === true,
    schemaInitialized: result[0]?.schema_initialized === true
  }
}
