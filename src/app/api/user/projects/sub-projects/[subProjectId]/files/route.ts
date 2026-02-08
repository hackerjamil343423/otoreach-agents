/**
 * Project Files API
 *
 * GET - Get all files in sub-project
 * POST - Create/Save file
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { saveFile } from '@/lib/supabase/files'
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
    const { name, content, fileType } = await req.json()

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 })
    }

    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'File content is required' }, { status: 400 })
    }

    const fileId = uuid()

    try {
      await saveFile(userId, {
        id: fileId,
        subProjectId,
        name: name.trim(),
        fileType: fileType || 'text',
        content
      })

      // Trigger webhook asynchronously (don't await to avoid blocking response)
      void sendFileToWebhook(userId, fileId, content, 'file.created').catch(err => {
        console.error('Webhook error (file.created):', err)
      })

      return NextResponse.json({ success: true, fileId })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to save file' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error saving file:', error)
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
  }
}
