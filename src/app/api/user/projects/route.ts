/**
 * User Projects API
 *
 * GET - Get all projects for current user
 * POST - Create new project
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { isSupabaseConfigured } from '@/lib/supabase/client'

// GET /api/user/projects - Get all projects
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const sessionResult = await validateSession(token)

    if (!sessionResult.valid || !sessionResult.payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = sessionResult.payload.userId

    // Check if Supabase is configured
    const configured = await isSupabaseConfigured(userId)

    if (!configured) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please contact administrator.' },
        { status: 403 }
      )
    }

    const result = await sql`
      SELECT
        p.*,
        COUNT(DISTINCT sp.id) as sub_projects_count,
        COUNT(DISTINCT pf.id) as total_files_count
      FROM projects p
      LEFT JOIN sub_projects sp ON sp.project_id = p.id
      LEFT JOIN project_files pf ON pf.sub_project_id = sp.id
      WHERE p.user_id = ${userId}
      GROUP BY p.id
      ORDER BY p.sort_order ASC, p.created_at DESC
    `

    return NextResponse.json({ projects: result })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// POST /api/user/projects - Create new project
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const sessionResult = await validateSession(token)

    if (!sessionResult.valid || !sessionResult.payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = sessionResult.payload.userId

    // Check if Supabase is configured
    const configured = await isSupabaseConfigured(userId)

    if (!configured) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please contact administrator.' },
        { status: 403 }
      )
    }

    const { name, description, icon, color } = await req.json()

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO projects (id, user_id, name, description, icon, color)
      VALUES (gen_random_uuid(), ${userId}, ${name.trim()}, ${description || null}, ${icon || 'folder'}, ${color || '#3b82f6'})
      RETURNING *
    `

    return NextResponse.json({ project: result[0] })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
