import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from './encryption'
import { sql } from '../db'

export interface SupabaseConfig {
  url: string
  serviceRoleKey?: string
  bucketName?: string
}

export interface StoredCredential {
  encrypted: string
  iv: string
  authTag: string
}

export interface StoredConfig {
  supabase_url: StoredCredential
  supabase_anon_key?: StoredCredential
  service_role_secret?: StoredCredential
  project_bucket_name?: string
  use_service_role?: boolean
  schema_initialized?: boolean
}

export type CredentialType = 'anon' | 'service_role'

/**
 * Create a Supabase client for a specific user
 * Retrieves and decrypts the user's Supabase credentials from the database
 * 
 * @param userId - The user ID
 * @param credentialType - Which credential to use ('service_role' for admin access, 'anon' for limited access)
 */
export async function createSupabaseClient(
  userId: string,
  credentialType: CredentialType = 'service_role'
): Promise<SupabaseClient> {
  const result = await sql`
    SELECT supabase_url, supabase_anon_key, service_role_secret, project_bucket_name, use_service_role
    FROM user_supabase_config
    WHERE user_id = ${userId} AND is_configured = TRUE
  `

  if (result.length === 0) {
    throw new Error('Supabase not configured for user')
  }

  const config = result[0] as StoredConfig

  // Decrypt URL
  const url = await decrypt(
    config.supabase_url.encrypted,
    config.supabase_url.iv,
    config.supabase_url.authTag
  )

  let key: string

  // Determine which key to use
  const useServiceRole = credentialType === 'service_role' || config.use_service_role

  if (useServiceRole && config.service_role_secret) {
    // Use service role key for admin access
    key = await decrypt(
      config.service_role_secret.encrypted,
      config.service_role_secret.iv,
      config.service_role_secret.authTag
    )
  } else if (config.supabase_anon_key) {
    // Fallback to anon key
    key = await decrypt(
      config.supabase_anon_key.encrypted,
      config.supabase_anon_key.iv,
      config.supabase_anon_key.authTag
    )
  } else {
    throw new Error(`No ${useServiceRole ? 'service role' : 'anon'} key configured for user`)
  }

  return createClient(url, key)
}

/**
 * Create a Supabase client with service role key (admin access)
 * This provides full database access bypassing RLS
 */
export async function createSupabaseAdminClient(userId: string): Promise<SupabaseClient> {
  return createSupabaseClient(userId, 'service_role')
}

/**
 * Create a Supabase client with anon key (limited access)
 * This respects RLS policies
 */
export async function createSupabaseAnonClient(userId: string): Promise<SupabaseClient> {
  return createSupabaseClient(userId, 'anon')
}

/**
 * Test the Supabase connection for a user
 * Returns success status and optional error message
 */
export async function testSupabaseConnection(
  userId: string,
  credentialType: CredentialType = 'service_role'
): Promise<{ success: boolean; error?: string; isAdmin?: boolean }> {
  try {
    const supabase = await createSupabaseClient(userId, credentialType)
    
    // Test connection by listing buckets (requires storage permissions)
    const { error: storageError } = await supabase.storage.listBuckets()
    
    if (storageError) {
      // Storage error might mean service role doesn't have storage access
      // Try a simple database query instead
      const { error: dbError } = await supabase.from('_tables').select('*').limit(1)
      
      if (dbError && dbError.message.includes('relation')) {
        // Try listing schemas as another fallback
        const { error: schemaError } = await supabase.rpc('get_schema_names')
        
        if (schemaError) {
          return {
            success: false,
            error: `Connection failed: ${storageError.message}`,
            isAdmin: credentialType === 'service_role'
          }
        }
      }
    }

    return { 
      success: true, 
      isAdmin: credentialType === 'service_role' 
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
      isAdmin: credentialType === 'service_role'
    }
  }
}

/**
 * Ensure the projects bucket exists in the user's Supabase
 * Creates it if it doesn't exist (requires service role)
 */
export async function ensureProjectBucket(userId: string): Promise<void> {
  let supabase
  try {
    supabase = await createSupabaseClient(userId, 'service_role')
  } catch (error) {
    // User doesn't have service role configured - try with anon key
    // We won't be able to create the bucket, but we can check if it exists
    console.warn('Service role not configured, checking bucket with anon key')
    try {
      supabase = await createSupabaseClient(userId, 'anon')
    } catch (anonError) {
      throw new Error('No valid Supabase credentials configured')
    }
  }

  const { data: buckets, error } = await supabase.storage.listBuckets()

  if (error) {
    // If we can't list buckets, the bucket might still exist
    // This can happen with anon key if RLS policies restrict bucket listing
    console.warn('Could not list buckets, continuing anyway:', error.message)
    return
  }

  const bucketName = 'projects'

  if (!buckets?.find(b => b.name === bucketName)) {
    // Try to create the bucket (will only work with service role)
    try {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: false
      })

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`)
      }
    } catch (createError) {
      console.warn('Could not create bucket:', createError)
      // Don't throw - the bucket might be created by an admin
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

/**
 * Check if user has service role configured
 */
export async function hasServiceRoleConfigured(userId: string): Promise<boolean> {
  const result = await sql`
    SELECT service_role_secret IS NOT NULL as has_service_role
    FROM user_supabase_config
    WHERE user_id = ${userId} AND is_configured = TRUE
  `

  return result.length > 0 && result[0]?.has_service_role === true
}

/**
 * Get the credential type being used for a user
 */
export async function getCredentialType(userId: string): Promise<CredentialType> {
  const result = await sql`
    SELECT use_service_role, service_role_secret IS NOT NULL as has_service_role
    FROM user_supabase_config
    WHERE user_id = ${userId}
  `

  if (result.length === 0) {
    return 'anon'
  }

  const { use_service_role, has_service_role } = result[0] as {
    use_service_role: boolean
    has_service_role: boolean
  }

  return use_service_role && has_service_role ? 'service_role' : 'anon'
}
