/**
 * Admin API: Test User Supabase Connection
 *
 * POST - Test the Supabase connection for a user
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { validateAdminSession } from '@/lib/auth/admin-session'
import { testSupabaseConnection } from '@/lib/supabase/client'
import { checkUserSupabaseSchema } from '@/lib/supabase/database'

async function validateAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_session')?.value
  if (!token) return false

  const sessionResult = await validateAdminSession(token)
  return sessionResult.valid && sessionResult.payload?.type === 'admin'
}

// POST /api/admin/users/[id]/supabase-config/test - Test connection
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await validateAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params

    // Get user's preferred credential type
    const configResult = await sql`
      SELECT use_service_role, service_role_secret IS NOT NULL as has_service_role
      FROM user_supabase_config
      WHERE user_id = ${userId}
    `

    const useServiceRole = configResult.length > 0 && 
      configResult[0]?.use_service_role === true &&
      configResult[0]?.has_service_role === true

    // Test the connection
    const credentialType = useServiceRole ? 'service_role' : 'anon'
    const result = await testSupabaseConnection(userId, credentialType)

    // If service role connection succeeded, also check schema status
    let schemaStatus = null
    if (result.success && useServiceRole) {
      schemaStatus = await checkUserSupabaseSchema(userId)
    }

    // Update last_verified_at if successful
    if (result.success) {
      await sql`
        UPDATE user_supabase_config
        SET last_verified_at = NOW()
        WHERE user_id = ${userId}
      `
    }

    return NextResponse.json({
      ...result,
      credentialType,
      schemaStatus
    })
  } catch (error) {
    console.error('Failed to test Supabase connection:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      },
      { status: 500 }
    )
  }
}
