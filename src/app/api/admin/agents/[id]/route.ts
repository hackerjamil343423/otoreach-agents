import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/admin/agents/[id] - Get single agent
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await sql`
      SELECT id, name, description, system_prompt, webhook_url,
             is_active, is_global, assigned_to, created_at, updated_at
      FROM agents
      WHERE id = ${id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agent = {
      ...result[0],
      assigned_to: (result[0] as { assigned_to?: string[] }).assigned_to || []
    }

    return NextResponse.json({ agent })
  } catch (error) {
    console.error('Failed to fetch agent:', error)
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 })
  }
}

// PATCH /api/admin/agents/[id] - Update agent
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, description, system_prompt, webhook_url, is_active, is_global, assigned_to } =
      await req.json()

    // Check if agent exists
    const existing = await sql`SELECT id FROM agents WHERE id = ${id}`
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Validate assigned_to users if provided
    if (assigned_to && assigned_to.length > 0) {
      const userCheck = await sql`SELECT id FROM users WHERE id = ANY(${assigned_to})`
      if (userCheck.length !== assigned_to.length) {
        return NextResponse.json({ error: 'One or more users not found' }, { status: 404 })
      }
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: unknown[] = []

    if (name !== undefined) {
      updates.push(`name = $${updates.length + 1}`)
      values.push(name)
    }

    if (description !== undefined) {
      updates.push(`description = $${updates.length + 1}`)
      values.push(description)
    }

    if (system_prompt !== undefined) {
      updates.push(`system_prompt = $${updates.length + 1}`)
      values.push(system_prompt)
    }

    if (webhook_url !== undefined) {
      updates.push(`webhook_url = $${updates.length + 1}`)
      values.push(webhook_url)
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${updates.length + 1}`)
      values.push(is_active)
    }

    if (is_global !== undefined) {
      updates.push(`is_global = $${updates.length + 1}`)
      values.push(is_global)
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${updates.length + 1}`)
      values.push(assigned_to)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(id)

    const result = await sql.query(
      `
      UPDATE agents
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, name, description, system_prompt, webhook_url,
                is_active, is_global, assigned_to, created_at, updated_at
    `,
      values
    )

    const agent = {
      ...result[0],
      assigned_to: (result[0] as { assigned_to?: string[] }).assigned_to || []
    }

    return NextResponse.json({
      success: true,
      agent
    })
  } catch (error) {
    console.error('Failed to update agent:', error)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}

// DELETE /api/admin/agents/[id] - Delete agent
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if agent exists
    const existing = await sql`SELECT id FROM agents WHERE id = ${id}`
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Delete agent
    await sql`DELETE FROM agents WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete agent:', error)
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
  }
}
