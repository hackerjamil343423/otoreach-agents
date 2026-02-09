import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { v4 as uuid } from 'uuid'

// GET /api/user/chats - Get all chats for current user
export async function GET(req: NextRequest) {
  try {
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

    // Fetch user's chats ordered by updated_at descending
    // Note: Removed persona references since we use agents now
    const result = await sql`
      SELECT id, title, session_id, created_at, updated_at
      FROM chats
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC
    `

    // Map to expected format with empty persona info
    const chats = (
      result as {
        id: string
        title: string
        session_id: string
        created_at: string
        updated_at: string
      }[]
    ).map((chat) => ({
      ...chat,
      persona_id: null,
      persona_name: null,
      persona_prompt: null
    }))

    return NextResponse.json({ chats })
  } catch (error) {
    console.error('Failed to fetch chats:', error)
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
  }
}

// POST /api/user/chats - Create a new chat
export async function POST(req: NextRequest) {
  try {
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

    // Generate session_id for this chat
    const sessionId = uuid()
    const now = new Date().toISOString()

    const result = await sql`
      INSERT INTO chats (id, user_id, title, session_id, created_at, updated_at)
      VALUES (${uuid()}, ${user.id}, ${title || 'New Chat'}, ${sessionId}, ${now}, ${now})
      RETURNING id, title, session_id, created_at, updated_at
    `

    return NextResponse.json({
      success: true,
      chat: result[0]!
    })
  } catch (error) {
    console.error('Failed to create chat:', error)
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}
