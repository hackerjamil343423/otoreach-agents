/**
 * Chat Project Link API
 *
 * GET - Get linked project for a chat
 * PUT - Link chat to project
 * DELETE - Unlink chat from project
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

// GET /api/user/chats/[id]/project - Get linked project
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
    const { id: chatId } = await params

    // Verify chat ownership
    const chat = await sql`
      SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${userId}
    `

    if (chat.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Get linked project
    const result = await sql`
      SELECT p.* FROM projects p
      JOIN chat_project_links cpl ON cpl.project_id = p.id
      WHERE cpl.chat_id = ${chatId}
    `

    if (result.length === 0) {
      return NextResponse.json({ project: null })
    }

    return NextResponse.json({ project: result[0] })
  } catch (error) {
    console.error('Error fetching linked project:', error)
    return NextResponse.json({ error: 'Failed to fetch linked project' }, { status: 500 })
  }
}

// PUT /api/user/chats/[id]/project - Link chat to project
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
    const { id: chatId } = await params
    const { projectId } = await req.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Verify chat ownership
    const chat = await sql`
      SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${userId}
    `

    if (chat.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Verify project ownership
    const project = await sql`
      SELECT id, name, color FROM projects WHERE id = ${projectId} AND user_id = ${userId}
    `

    if (project.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create link (unique constraint ensures only one link per chat)
    await sql`
      INSERT INTO chat_project_links (chat_id, project_id)
      VALUES (${chatId}, ${projectId})
      ON CONFLICT (chat_id) DO UPDATE SET project_id = EXCLUDED.project_id
    `

    return NextResponse.json({ project: project[0] })
  } catch (error) {
    console.error('Error linking project:', error)
    return NextResponse.json({ error: 'Failed to link project' }, { status: 500 })
  }
}

// DELETE /api/user/chats/[id]/project - Unlink chat from project
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
    const { id: chatId } = await params

    // Verify chat ownership
    const chat = await sql`
      SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${userId}
    `

    if (chat.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Delete link
    await sql`DELETE FROM chat_project_links WHERE chat_id = ${chatId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unlinking project:', error)
    return NextResponse.json({ error: 'Failed to unlink project' }, { status: 500 })
  }
}
