import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { v4 as uuid } from 'uuid'

// GET /api/admin/agents - List all agents with optional filtering
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    let query = `
      SELECT a.id, a.name, a.description, a.system_prompt, a.webhook_url,
             a.is_active, a.is_global, a.category, a.assigned_to, a.created_at, a.updated_at
      FROM agents a
    `

    // Filter by user - show agents assigned to this user OR global agents
    if (userId) {
      query = `
        SELECT DISTINCT a.id, a.name, a.description, a.system_prompt, a.webhook_url,
               a.is_active, a.is_global, a.category, a.assigned_to, a.created_at, a.updated_at
        FROM agents a
        WHERE a.is_global = false AND ${userId} = ANY(a.assigned_to)
           OR a.is_global = true
        ORDER BY a.is_global DESC, a.created_at DESC
      `
    } else {
      query += ' ORDER BY a.is_global DESC, a.created_at DESC'
    }

    const result = await sql.query(query)

    // Transform assigned_to array to ensure proper JSON serialization
    const agents = result.map((agent: { assigned_to?: string[] }) => ({
      ...agent,
      assigned_to: agent.assigned_to || []
    }))

    return NextResponse.json({ agents })
  } catch (error) {
    console.error('Failed to fetch agents:', error)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

// POST /api/admin/agents - Create new agent
export async function POST(req: NextRequest) {
  try {
    const { name, description, system_prompt, webhook_url, is_active, is_global, category, assigned_to } =
      await req.json()

    if (!name || !system_prompt) {
      return NextResponse.json({ error: 'Name and system prompt are required' }, { status: 400 })
    }

    // Validate assigned_to users if provided
    if (assigned_to && assigned_to.length > 0) {
      const userCheck = await sql`
        SELECT id FROM users WHERE id = ANY(${assigned_to})
      `
      if (userCheck.length !== assigned_to.length) {
        return NextResponse.json({ error: 'One or more users not found' }, { status: 404 })
      }
    }

    const result = await sql`
      INSERT INTO agents (
        id, name, description, system_prompt, webhook_url,
        is_active, is_global, category, assigned_to
      )
      VALUES (
        ${uuid()}, ${name}, ${description || null}, ${system_prompt},
        ${webhook_url || null}, ${is_active !== false}, ${is_global !== false},
        ${category || null}, ${assigned_to || []}
      )
      RETURNING id, name, description, system_prompt, webhook_url,
                is_active, is_global, category, assigned_to, created_at, updated_at
    `

    return NextResponse.json({
      success: true,
      agent: result[0]
    })
  } catch (error) {
    console.error('Failed to create agent:', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
