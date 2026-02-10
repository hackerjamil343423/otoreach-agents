/**
 * Project Files API
 *
 * GET - Get all files in sub-project
 * POST - Create/Save file (Neon DB only, no Supabase storage)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { v4 as uuid } from 'uuid'
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

// GET /api/user/projects/sub-projects/[subProjectId]/files - List files
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subProjectId: string }> }
) {
  try {
    const auth = await validateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subProjectId } = await params

    const files = await sql`
      SELECT * FROM project_files
      WHERE sub_project_id = ${subProjectId}
      ORDER BY name ASC
    `

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

// POST /api/user/projects/sub-projects/[subProjectId]/files - Create file
export async function POST(
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

    // Validate request body
    let requestBody
    try {
      requestBody = await req.json()
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { name, content, fileType, category, subCategory, description } = requestBody

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 })
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'File content is required' }, { status: 400 })
    }

    // Verify sub-project exists and get project info
    const subProjectCheck = await sql`
      SELECT sp.id, sp.name, p.id as project_id, p.name as project_name
      FROM sub_projects sp
      JOIN projects p ON p.id = sp.project_id
      WHERE sp.id = ${subProjectId} AND p.user_id = ${userId}
    `

    if (subProjectCheck.length === 0) {
      console.error('Sub-project not found or access denied:', { userId, subProjectId })
      return NextResponse.json({ error: 'Sub-project not found' }, { status: 404 })
    }

    const record = subProjectCheck[0] as Record<string, unknown>
    const { project_id, project_name } = record

    // Generate a unique file ID
    const fileId = uuid()
    const contentString = String(content)

    // Save to Neon database with content
    await sql`
      INSERT INTO project_files (id, sub_project_id, name, file_type, supabase_storage_path, size_bytes, description, content)
      VALUES (
        ${fileId},
        ${subProjectId},
        ${name.trim()},
        ${fileType || 'text'},
        ${fileId},
        ${contentString.length},
        ${description || null},
        ${contentString}
      )
    `

    console.log('[File Created] Saved to Neon DB:', { fileId, name: name.trim() })

    // Send to webhook asynchronously
    void sendFileToWebhook(userId, fileId, contentString, 'file.created', {
      project_id: project_id as string,
      project_name: project_name as string,
      sub_project_id: subProjectId,
      sub_project_name: record.name as string,
      file_name: name.trim(),
      file_type: fileType || 'text',
      category,
      sub_category: subCategory
    }).catch(err => {
      console.error('Webhook error (file.created):', err)
    })

    return NextResponse.json({
      success: true,
      fileId,
      message: 'File created successfully'
    })
  } catch (error) {
    console.error('Error saving file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save file' },
      { status: 500 }
    )
  }
}
