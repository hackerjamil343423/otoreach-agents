import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'

// GET /api/user/chats/[id] - Get a specific chat
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chatId } = await params

    // Get user from cookie (preferred) or email header (fallback)
    const token = req.cookies.get('auth_token')?.value
    const userEmail = req.headers.get('x-user-email')

    let user: { id: string; email: string; name: string | null } | null = null

    if (token) {
      // Validate session from cookie
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

    const result = await sql`
      SELECT id, title, session_id, created_at, updated_at
      FROM chats
      WHERE id = ${chatId} AND user_id = ${user.id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    return NextResponse.json({ chat: result[0] })
  } catch (error) {
    console.error('Failed to fetch chat:', error)
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 })
  }
}

// DELETE /api/user/chats/[id] - Delete a chat
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chatId } = await params

    // Get user from cookie (preferred) or email header (fallback)
    const token = req.cookies.get('auth_token')?.value
    const userEmail = req.headers.get('x-user-email')

    let user: { id: string; email: string; name: string | null } | null = null

    if (token) {
      // Validate session from cookie
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

    // Check if chat exists and belongs to user
    const chatCheck = await sql`
      SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${user.id}
    `

    if (chatCheck.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    // Delete the chat (messages will cascade delete)
    await sql`DELETE FROM chats WHERE id = ${chatId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete chat:', error)
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 })
  }
}

// PATCH /api/user/chats/[id] - Update chat title
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: chatId } = await params

    // Get user from cookie (preferred) or email header (fallback)
    const token = req.cookies.get('auth_token')?.value
    const userEmail = req.headers.get('x-user-email')

    let user: { id: string; email: string; name: string | null } | null = null

    if (token) {
      // Validate session from cookie
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

    const { title } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Check if chat exists and belongs to user
    const chatCheck = await sql`
      SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${user.id}
    `

    if (chatCheck.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const result = await sql`
      UPDATE chats
      SET title = ${title}, updated_at = ${new Date().toISOString()}
      WHERE id = ${chatId}
      RETURNING id, title, session_id, created_at, updated_at
    `

    return NextResponse.json({
      success: true,
      chat: result[0]
    })
  } catch (error) {
    console.error('Failed to update chat:', error)
    return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 })
  }
}
