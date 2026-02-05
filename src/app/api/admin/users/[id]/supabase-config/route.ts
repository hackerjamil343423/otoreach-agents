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
      SELECT is_configured, last_verified_at, project_bucket_name, created_at
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
    const { supabaseUrl, supabaseAnonKey, projectBucketName } = await req.json()

    // Validate inputs
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase URL and Anon Key are required' },
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

    const encryptedUrl = await encrypt(supabaseUrl)
    const encryptedKey = await encrypt(supabaseAnonKey)
    const bucketName = projectBucketName || 'projects'

    await sql`
      INSERT INTO user_supabase_config (user_id, supabase_url, supabase_anon_key, project_bucket_name, is_configured)
      VALUES (${userId}, ${encryptedUrl}, ${encryptedKey}, ${bucketName}, TRUE)
      ON CONFLICT (user_id) DO UPDATE SET
        supabase_url = EXCLUDED.supabase_url,
        supabase_anon_key = EXCLUDED.supabase_anon_key,
        project_bucket_name = EXCLUDED.project_bucket_name,
        is_configured = TRUE,
        updated_at = NOW()
    `

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
