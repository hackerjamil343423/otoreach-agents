/**
 * Admin API: User Supabase Configuration
 *
 * GET - Get user's Supabase config status (without sensitive data)
 * POST - Save/Update user's Supabase config
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { validateAdminSession } from '@/lib/auth/admin-session'
import { encrypt } from '@/lib/supabase/encryption'

async function validateAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_session')?.value
  if (!token) return false

  const sessionResult = await validateAdminSession(token)
  return sessionResult.valid && sessionResult.payload?.type === 'admin'
}

// GET /api/admin/users/[id]/supabase-config - Get config status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await validateAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params

    const result = await sql`
      SELECT 
        is_configured, 
        last_verified_at, 
        project_bucket_name, 
        created_at,
        use_service_role,
        schema_initialized,
        service_role_secret IS NOT NULL as has_service_role
      FROM user_supabase_config
      WHERE user_id = ${userId}
    `

    return NextResponse.json(result[0] || { is_configured: false })
  } catch (error) {
    console.error('Failed to fetch Supabase config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    )
  }
}

// POST /api/admin/users/[id]/supabase-config - Save/Update config
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await validateAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params
    const { 
      supabaseUrl, 
      supabaseAnonKey, 
      serviceRoleSecret,
      projectBucketName,
      useServiceRole 
    } = await req.json()

    // Validate inputs
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL is required' },
        { status: 400 }
      )
    }

    // Validate Supabase URL format
    try {
      new URL(supabaseUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid Supabase URL format' },
        { status: 400 }
      )
    }

    // Require at least one key (anon or service role)
    if (!supabaseAnonKey && !serviceRoleSecret) {
      return NextResponse.json(
        { error: 'At least one key (Anon Key or Service Role Secret) is required' },
        { status: 400 }
      )
    }

    const encryptedUrl = await encrypt(supabaseUrl)
    const bucketName = projectBucketName || 'projects'
    const useServiceRoleFlag = useServiceRole === true

    // Encrypt credentials
    const encryptedAnonKey = supabaseAnonKey ? await encrypt(supabaseAnonKey) : null
    const encryptedServiceRole = serviceRoleSecret ? await encrypt(serviceRoleSecret) : null

    // Check if config already exists
    const existingConfig = await sql`
      SELECT supabase_anon_key, service_role_secret 
      FROM user_supabase_config 
      WHERE user_id = ${userId}
    `

    if (existingConfig.length > 0 && existingConfig[0]) {
      // Update existing config - preserve existing keys if new ones not provided
      const existing = existingConfig[0] as { supabase_anon_key: string | null; service_role_secret: string | null }
      const finalAnonKey = encryptedAnonKey ?? existing.supabase_anon_key
      const finalServiceRole = encryptedServiceRole ?? existing.service_role_secret

      await sql`
        UPDATE user_supabase_config
        SET 
          supabase_url = ${encryptedUrl},
          supabase_anon_key = ${finalAnonKey},
          service_role_secret = ${finalServiceRole},
          project_bucket_name = ${bucketName},
          is_configured = TRUE,
          use_service_role = ${useServiceRoleFlag},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `
    } else {
      // Insert new config
      await sql`
        INSERT INTO user_supabase_config (
          user_id, 
          supabase_url, 
          supabase_anon_key, 
          service_role_secret,
          project_bucket_name, 
          is_configured,
          use_service_role
        )
        VALUES (
          ${userId}, 
          ${encryptedUrl}, 
          ${encryptedAnonKey}, 
          ${encryptedServiceRole},
          ${bucketName}, 
          TRUE,
          ${useServiceRoleFlag}
        )
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save Supabase config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id]/supabase-config - Remove config
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await validateAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params

    await sql`DELETE FROM user_supabase_config WHERE user_id = ${userId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete Supabase config:', error)
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    )
  }
}
