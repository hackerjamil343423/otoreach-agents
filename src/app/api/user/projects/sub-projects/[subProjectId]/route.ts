/**
 * Individual Sub-Project API
 *
 * DELETE - Delete a sub-project and all its files
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

// DELETE /api/user/projects/sub-projects/[subProjectId] - Delete sub-project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ subProjectId: string }> }
) {
  try {
    const auth = await validateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = auth
    const { subProjectId } = await params

    // Verify sub-project ownership through project
    const subProject = await sql`
      SELECT sp.id, sp.project_id
      FROM sub_projects sp
      JOIN projects p ON p.id = sp.project_id
      WHERE sp.id = ${subProjectId} AND p.user_id = ${userId}
    `

    if (subProject.length === 0) {
      return NextResponse.json({ error: 'Sub-project not found' }, { status: 404 })
    }

    // Delete all files in the sub-project first (cascade should handle this, but being explicit)
    await sql`DELETE FROM project_files WHERE sub_project_id = ${subProjectId}`

    // Delete the sub-project
    await sql`DELETE FROM sub_projects WHERE id = ${subProjectId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sub-project:', error)
    return NextResponse.json({ error: 'Failed to delete sub-project' }, { status: 500 })
  }
}
