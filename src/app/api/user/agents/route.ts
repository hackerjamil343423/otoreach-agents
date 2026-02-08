import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'

// GET /api/user/agents - Get current user's assigned agents
export async function GET(req: NextRequest) {
  try {
    // Get auth token from cookie
    const token = req.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Validate session using JWT
    const sessionResult = await validateSession(token)

    if (!sessionResult.valid || !sessionResult.payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = sessionResult.payload.userId

    // Get user info
    const userResult = await sql`
      SELECT id, email, name FROM users WHERE id = ${userId}
    `

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get assigned agents using new schema
    // Agents are available if:
    // 1. They are global (is_global = true) AND the user's ID is in assigned_to array
    // 2. OR they are private (is_global = false) AND the user's ID is in assigned_to array
    const agentsResult = await sql`
      SELECT id, name, description, system_prompt, webhook_url, is_global, assigned_to
      FROM agents
      WHERE is_active = true
        AND ${userId} = ANY(assigned_to)
      ORDER BY is_global DESC, name ASC
    `

    return NextResponse.json({
      agents: agentsResult
    })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}
