/**
 * Admin API: Initialize User Supabase Schema
 *
 * POST - Create required tables in user's Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession } from '@/lib/auth/admin-session'
import { initializeUserSupabase, checkUserSupabaseSchema, USER_SUPABASE_SETUP_SQL } from '@/lib/supabase/database'

async function validateAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_session')?.value
  if (!token) return false

  const sessionResult = await validateAdminSession(token)
  return sessionResult.valid && sessionResult.payload?.type === 'admin'
}

// POST /api/admin/users/[id]/supabase-config/init - Initialize schema
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await validateAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params

    // Initialize the schema
    const result = await initializeUserSupabase(userId)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    // Get updated schema status
    const schemaStatus = await checkUserSupabaseSchema(userId)

    return NextResponse.json({
      ...result,
      schemaStatus
    })
  } catch (error) {
    console.error('Failed to initialize Supabase schema:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      },
      { status: 500 }
    )
  }
}

// GET /api/admin/users/[id]/supabase-config/init - Get setup SQL
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void params
  try {
    if (!(await validateAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return the SQL script for manual execution
    return NextResponse.json({
      sql: USER_SUPABASE_SETUP_SQL,
      instructions: [
        '1. Go to your Supabase project dashboard',
        '2. Open the SQL Editor',
        '3. Create a New Query',
        '4. Paste the SQL below',
        '5. Click Run'
      ]
    })
  } catch (error) {
    console.error('Failed to get setup SQL:', error)
    return NextResponse.json(
      { error: 'Failed to get setup SQL' },
      { status: 500 }
    )
  }
}
