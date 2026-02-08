/**
 * Individual File API
 *
 * GET - Get a single file
 * PUT - Update file content
 * DELETE - Delete a file
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { createSupabaseAdminClient } from '@/lib/supabase/client'
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

// GET /api/user/projects/sub-projects/files/[id] - Get file content
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

    // Get file metadata and verify ownership
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

    const file = fileResult[0]

    // Get file content from Supabase
    const supabase = await createSupabaseAdminClient(userId)
    const { data, error } = await supabase.storage
      .from('projects')
      .download(file.supabase_storage_path)

    if (error) {
      console.error('Failed to download file:', error)
      return NextResponse.json({ error: 'Failed to load file content' }, { status: 500 })
    }

    const content = await data.text()

    return NextResponse.json({
      ...file,
      content
    })
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
    const { content, description } = await req.json()

    // Get file metadata and verify ownership
    const fileResult = await sql`
      SELECT pf.*
      FROM project_files pf
      JOIN sub_projects sp ON sp.id = pf.sub_project_id
      JOIN projects p ON p.id = sp.project_id
      WHERE pf.id = ${fileId} AND p.user_id = ${userId}
    `

    if (fileResult.length === 0 || !fileResult[0]) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = fileResult[0]

    // Update file in Supabase if content is provided
    if (content !== undefined) {
      const supabase = await createSupabaseAdminClient(userId)
      const encoder = new TextEncoder()
      const uint8Array = encoder.encode(content)
      const blob = new Blob([uint8Array], { type: 'text/plain' })

      const { error } = await supabase.storage
        .from('projects')
        .upload(file.supabase_storage_path, blob, { upsert: true })

      if (error) {
        console.error('Failed to upload file:', error)
        return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
      }

      // Update metadata in database
      await sql`
        UPDATE project_files 
        SET size_bytes = ${content.length}, updated_at = NOW()
        WHERE id = ${fileId}
      `
    }

    // Update description if provided
    if (description !== undefined) {
      await sql`
        UPDATE project_files 
        SET description = ${description || null}, updated_at = NOW()
        WHERE id = ${fileId}
      `
    }

    // Trigger webhook asynchronously if content was updated
    if (content !== undefined) {
      void sendFileToWebhook(userId, fileId, content, 'file.updated').catch(err => {
        console.error('Webhook error (file.updated):', err)
      })
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

    // Get file metadata and verify ownership
    const fileResult = await sql`
      SELECT pf.supabase_storage_path
      FROM project_files pf
      JOIN sub_projects sp ON sp.id = pf.sub_project_id
      JOIN projects p ON p.id = sp.project_id
      WHERE pf.id = ${fileId} AND p.user_id = ${userId}
    `

    if (fileResult.length === 0 || !fileResult[0]) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const { supabase_storage_path } = fileResult[0]

    // Delete from Supabase
    const supabase = await createSupabaseAdminClient(userId)
    await supabase.storage
      .from('projects')
      .remove([supabase_storage_path])

    // Delete from database
    await sql`DELETE FROM project_files WHERE id = ${fileId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
