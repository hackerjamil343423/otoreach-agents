/**
 * Single File API
 *
 * GET - Load file content
 * DELETE - Delete file
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { loadFile, deleteFile } from '@/lib/supabase/files'
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

// GET /api/user/projects/sub-projects/files/[id] - Load file content
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

    try {
      const result = await loadFile(userId, fileId)
      return NextResponse.json(result)
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error loading file:', error)
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 })
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

    await deleteFile(userId, fileId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
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
    const { content } = await req.json()

    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'File content is required' }, { status: 400 })
    }

    // Get file metadata to update
    const fileResult = await sql`
      SELECT * FROM project_files WHERE id = ${fileId}
    `

    if (fileResult.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = fileResult[0]!

    // Use saveFile to update
    const { saveFile } = await import('@/lib/supabase/files')

    try {
      await saveFile(userId, {
        id: fileId,
        subProjectId: file.sub_project_id!,
        name: file.name!,
        fileType: file.file_type as 'text' | 'markdown',
        content
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to update file' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error updating file:', error)
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
  }
}
