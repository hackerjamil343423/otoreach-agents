import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from './encryption'
import { sql } from '../db'

export interface SupabaseConfig {
  url: string
  anonKey: string
  bucketName?: string
}

export interface StoredCredential {
  encrypted: string
  iv: string
  authTag: string
}

export interface StoredConfig {
  supabase_url: StoredCredential
  supabase_anon_key: StoredCredential
  project_bucket_name?: string
}

/**
 * Create a Supabase client for a specific user
 * Retrieves and decrypts the user's Supabase credentials from the database
 */
export async function createSupabaseClient(userId: string): Promise<SupabaseClient> {
  const result = await sql`
    SELECT supabase_url, supabase_anon_key, project_bucket_name
    FROM user_supabase_config
    WHERE user_id = ${userId} AND is_configured = TRUE
  `

  if (result.length === 0) {
    throw new Error('Supabase not configured for user')
  }

  const config = result[0] as StoredConfig

  // Decrypt credentials
  const url = await decrypt(
    config.supabase_url.encrypted,
    config.supabase_url.iv,
    config.supabase_url.authTag
  )
  const anonKey = await decrypt(
    config.supabase_anon_key.encrypted,
    config.supabase_anon_key.iv,
    config.supabase_anon_key.authTag
  )

  return createClient(url, anonKey)
}

/**
 * Test the Supabase connection for a user
 * Returns success status and optional error message
 */
export async function testSupabaseConnection(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient(userId)
    const { error } = await supabase.storage.listBuckets()

    if (error) throw error

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}

/**
 * Ensure the projects bucket exists in the user's Supabase
 * Creates it if it doesn't exist
 */
export async function ensureProjectBucket(userId: string): Promise<void> {
  const supabase = await createSupabaseClient(userId)

  const { data: buckets, error } = await supabase.storage.listBuckets()

  if (error) {
    throw new Error(`Failed to list buckets: ${error.message}`)
  }

  const bucketName = 'projects'

  if (!buckets?.find(b => b.name === bucketName)) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: false
    })

    if (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`)
    }
  }
}

/**
 * Check if a user has Supabase configured
 */
export async function isSupabaseConfigured(userId: string): Promise<boolean> {
  const result = await sql`
    SELECT is_configured FROM user_supabase_config
    WHERE user_id = ${userId}
  `

  return result.length > 0 && result[0]?.is_configured === true
}
