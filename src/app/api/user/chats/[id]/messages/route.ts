import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { v4 as uuid } from 'uuid'

// GET /api/user/chats/[id]/messages - Get messages for a chat
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chatId } = await params

    const authHeader = req.headers.get('authorization')
    const userEmail = req.headers.get('x-user-email')

    let user: { id: string; email: string; name: string | null } | null = null

    if (authHeader) {
      // Extract token from "Bearer <token>" format
      const token = authHeader.replace('Bearer ', '')
      const sessionResult = await validateSession(token)
      if (sessionResult.valid && sessionResult.payload) {
        // Get user from database
        const userResult = await sql`
          SELECT id, email, name FROM users WHERE id = ${sessionResult.payload.userId}
        `
        if (userResult.length > 0) {
          user = userResult[0] as { id: string; email: string; name: string | null }
        }
      }
    } else if (userEmail) {
      user = await getCurrentUser(userEmail)
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if chat belongs to user
    const chatCheck = await sql`
      SELECT id, session_id FROM chats WHERE id = ${chatId} AND user_id = ${user.id}
    `

    if (chatCheck.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Fetch messages
    const result = await sql`
      SELECT id, role, content, created_at
      FROM messages
      WHERE chat_id = ${chatId}
      ORDER BY created_at ASC
    `

    return NextResponse.json({
      messages: result,
      session_id: chatCheck[0]?.session_id || null
    })
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST /api/user/chats/[id]/messages - Add a message to a chat
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chatId } = await params

    const authHeader = req.headers.get('authorization')
    const userEmail = req.headers.get('x-user-email')

    let user: { id: string; email: string; name: string | null } | null = null

    if (authHeader) {
      // Extract token from "Bearer <token>" format
      const token = authHeader.replace('Bearer ', '')
      const sessionResult = await validateSession(token)
      if (sessionResult.valid && sessionResult.payload) {
        // Get user from database
        const userResult = await sql`
          SELECT id, email, name FROM users WHERE id = ${sessionResult.payload.userId}
        `
        if (userResult.length > 0) {
          user = userResult[0] as { id: string; email: string; name: string | null }
        }
      }
    } else if (userEmail) {
      user = await getCurrentUser(userEmail)
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { role, content } = await req.json()

    if (!role || !content) {
      return NextResponse.json({ error: 'Role and content are required' }, { status: 400 })
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if chat belongs to user
    const chatCheck = await sql`
      SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${user.id}
    `

    if (chatCheck.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    const result = await sql`
      INSERT INTO messages (id, chat_id, role, content, created_at)
      VALUES (${uuid()}, ${chatId}, ${role}, ${JSON.stringify(content)}, ${now})
      RETURNING id, role, content, created_at
    `

    // Update chat's updated_at
    await sql`
      UPDATE chats SET updated_at = ${now} WHERE id = ${chatId}
    `

    return NextResponse.json({
      success: true,
      message: result[0]
    })
  } catch (error) {
    console.error('Failed to create message:', error)
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
}
