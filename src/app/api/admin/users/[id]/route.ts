import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET /api/admin/users/[id] - Get single user
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await sql`
      SELECT id, email, name, avatar_url, email_verified, webhook_url, created_at, updated_at
      FROM users
      WHERE id = ${id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's assigned agents (user-specific OR global agents where user is in assigned_to)
    const agentsResult = await sql`
      SELECT a.id, a.name, a.description, a.webhook_url, a.is_global
      FROM agents a
      WHERE a.is_active = true
        AND (
          a.is_global = false AND ${id} = ANY(a.assigned_to)
          OR a.is_global = true AND ${id} = ANY(a.assigned_to)
        )
      ORDER BY a.is_global DESC, a.name ASC
    `

    return NextResponse.json({
      user: result[0],
      assignedAgents: agentsResult
    })
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { email, password, name, webhook_url } = await req.json()

    // Check if user exists
    const existing = await sql`SELECT * FROM users WHERE id = ${id}`
    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build update query
    const updates: string[] = []
    const values: unknown[] = []

    if (email) {
      // Check if email is taken by another user
      const emailCheck = await sql`SELECT id FROM users WHERE email = ${email} AND id != ${id}`
      if (emailCheck.length > 0) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 400 })
      }
      updates.push(`email = $${updates.length + 1}`)
      values.push(email)
    }

    if (name !== undefined) {
      updates.push(`name = $${updates.length + 1}`)
      values.push(name || null)
    }

    if (webhook_url !== undefined) {
      // Validate webhook URL format
      if (webhook_url && webhook_url.trim() !== '') {
        try {
          new URL(webhook_url)
        } catch {
          return NextResponse.json({ error: 'Invalid webhook URL format' }, { status: 400 })
        }
      }
      updates.push(`webhook_url = $${updates.length + 1}`)
      values.push(webhook_url || null)
    }

    if (password) {
      const password_hash = await bcrypt.hash(password, 10)
      updates.push(`password_hash = $${updates.length + 1}`)
      values.push(password_hash)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    // Use parameterized query properly
    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, email, name, webhook_url, updated_at
    `

    const result = await sql.query(updateQuery, values)

    return NextResponse.json({
      success: true,
      user: result[0]
    })
  } catch (error) {
    console.error('Failed to update user:', error)
    return NextResponse.json(
      {
        error: 'Failed to update user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if user exists
    const existing = await sql`SELECT id FROM users WHERE id = ${id}`
    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete user (cascades to chats, messages, user_agents)
    await sql`DELETE FROM users WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
