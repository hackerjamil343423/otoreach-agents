/**
 * Individual File API
 *
 * GET - Get a single file with content from Neon DB
 * PUT - Update file content and metadata
 * DELETE - Delete a file
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { sendFileToWebhook } from '@/lib/webhook/userWebhook'

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

// GET /api/user/projects/sub-projects/files/[id] - Get file with content
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
    const { id: fileId } = await params

    // Get file with content and verify ownership
    const fileResult = await sql`
      SELECT pf.*, sp.project_id
      FROM project_files pf
      JOIN sub_projects sp ON sp.id = pf.sub_project_id
      JOIN projects p ON p.id = sp.project_id
      WHERE pf.id = ${fileId} AND p.user_id = ${userId}
    `

    if (fileResult.length === 0 || !fileResult[0]) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json(fileResult[0])
  } catch (error) {
    console.error('Error fetching file:', error)
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
  }
}

// PUT /api/user/projects/sub-projects/files/[id] - Update file
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await validateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = auth
    const { id: fileId } = await params
    const { content, description, category, subCategory } = await req.json()

    // Get file metadata and verify ownership
    const fileResult = await sql`
      SELECT pf.*, sp.project_id, p.name as project_name, sp.name as sub_project_name
      FROM project_files pf
      JOIN sub_projects sp ON sp.id = pf.sub_project_id
      JOIN projects p ON p.id = sp.project_id
      WHERE pf.id = ${fileId} AND p.user_id = ${userId}
    `

    if (fileResult.length === 0 || !fileResult[0]) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = fileResult[0] as Record<string, unknown>

    // Update content in database if provided
    if (content !== undefined) {
      const contentString = String(content)
      await sql`
        UPDATE project_files
        SET content = ${contentString}, size_bytes = ${contentString.length}, updated_at = NOW()
        WHERE id = ${fileId}
      `

      // Trigger webhook asynchronously if content was updated
      void sendFileToWebhook(userId, fileId, contentString, 'file.updated', {
        project_id: file.project_id as string,
        project_name: file.project_name as string,
        sub_project_id: file.sub_project_id as string,
        sub_project_name: file.sub_project_name as string,
        file_name: file.name as string,
        file_type: file.file_type as string,
        category,
        sub_category: subCategory
      }).catch(err => {
        console.error('Webhook error (file.updated):', err)
      })
    }

    // Update description if provided
    if (description !== undefined) {
      await sql`
        UPDATE project_files
        SET description = ${description || null}, updated_at = NOW()
        WHERE id = ${fileId}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating file:', error)
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
  }
}

// DELETE /api/user/projects/sub-projects/files/[id] - Delete file
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
    const { id: fileId } = await params

    // Verify ownership
    const fileResult = await sql`
      SELECT pf.id
      FROM project_files pf
      JOIN sub_projects sp ON sp.id = pf.sub_project_id
      JOIN projects p ON p.id = sp.project_id
      WHERE pf.id = ${fileId} AND p.user_id = ${userId}
    `

    if (fileResult.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Delete from database
    await sql`DELETE FROM project_files WHERE id = ${fileId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
