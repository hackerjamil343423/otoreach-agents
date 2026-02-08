/**
 * Sub-Projects API
 *
 * GET - List sub-projects for a project
 * POST - Create sub-project
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'

async function validateRequest(req: NextRequest): Promise<{ userId: string } | null> {
  const token = req.cookies.get('auth_token')?.value

  if (!token) {
    return null
  }

  const sessionResult = await validateSession(token)

  if (!sessionResult.valid || !sessionResult.payload) {
    return null
  }

  return { userId: sessionResult.payload.userId }
}

// GET /api/user/projects/[id]/sub-projects - List sub-projects
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await validateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = auth
    const { id: projectId } = await params

    // Verify project ownership
    const project = await sql`
      SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
    `

    if (project.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await sql`
      SELECT * FROM sub_projects
      WHERE project_id = ${projectId}
      ORDER BY sort_order ASC, name ASC
    `

    return NextResponse.json({ sub_projects: result })
  } catch (error) {
    console.error('Error fetching sub-projects:', error)
    return NextResponse.json({ error: 'Failed to fetch sub-projects' }, { status: 500 })
  }
}

// POST /api/user/projects/[id]/sub-projects - Create sub-project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await validateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = auth
    const { id: projectId } = await params
    const { name, description, icon } = await req.json()

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Sub-project name is required' }, { status: 400 })
    }

    // Verify project ownership
    const project = await sql`
      SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
    `

    if (project.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO sub_projects (id, project_id, name, description, icon)
      VALUES (gen_random_uuid(), ${projectId}, ${name.trim()}, ${description || null}, ${icon || 'folder'})
      RETURNING *
    `

    return NextResponse.json({ sub_project: result[0] })
  } catch (error) {
    console.error('Error creating sub-project:', error)
    return NextResponse.json({ error: 'Failed to create sub-project' }, { status: 500 })
  }
}
