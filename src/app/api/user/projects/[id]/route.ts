/**
 * Single Project API
 *
 * GET - Get project with sub-projects and files
 * PATCH - Update project
 * DELETE - Delete project
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'

interface UpdateProjectBody {
  name?: string
  description?: string | null
  icon?: string | null
  color?: string | null
}

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

// GET /api/user/projects/[id] - Get project details
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

    // Get project
    const project = await sql`
      SELECT * FROM projects WHERE id = ${projectId} AND user_id = ${userId}
    `

    if (project.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get sub-projects with files
    const subProjects = await sql`
      SELECT
        sp.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pf.id,
              'name', pf.name,
              'file_type', pf.file_type,
              'size_bytes', pf.size_bytes,
              'updated_at', pf.updated_at
            ) ORDER BY pf.name
          ) FILTER (WHERE pf.id IS NOT NULL),
          '[]'
        ) as files
      FROM sub_projects sp
      LEFT JOIN project_files pf ON pf.sub_project_id = sp.id
      WHERE sp.project_id = ${projectId}
      GROUP BY sp.id
      ORDER BY sp.sort_order ASC, sp.name ASC
    `

    return NextResponse.json({
      project: project[0],
      sub_projects: subProjects
    })
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

// PATCH /api/user/projects/[id] - Update project
export async function PATCH(
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
    const body = (await req.json()) as UpdateProjectBody
    const { name, description, icon, color } = body

    // Verify ownership
    const existing = await sql`
      SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: unknown[] = []

    if (name !== undefined) {
      updates.push(`name = $${updates.length + 1}`)
      values.push(name.trim())
    }
    if (description !== undefined) {
      updates.push(`description = $${updates.length + 1}`)
      values.push(description)
    }
    if (icon !== undefined) {
      updates.push(`icon = $${updates.length + 1}`)
      values.push(icon)
    }
    if (color !== undefined) {
      updates.push(`color = $${updates.length + 1}`)
      values.push(color)
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`)
      values.push(projectId)

      const query = `
        UPDATE projects
        SET ${updates.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `

      const result = await sql.query(query, values)
      return NextResponse.json({ project: result[0] })
    }

    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// DELETE /api/user/projects/[id] - Delete project
export async function DELETE(
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

    // Verify ownership
    const project = await sql`
      SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
    `

    if (project.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete project (cascade will delete sub-projects and files metadata)
    await sql`DELETE FROM projects WHERE id = ${projectId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
