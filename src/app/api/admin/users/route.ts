import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

// GET /api/admin/users - List all users
export async function GET() {
  try {
    const result = await sql`
      SELECT id, email, name, avatar_url, email_verified, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST /api/admin/users - Create new user
export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Check if user exists
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10)

    // Create user
    const result = await sql`
      INSERT INTO users (id, email, password_hash, name, email_verified)
      VALUES (${uuid()}, ${email}, ${password_hash}, ${name || null}, true)
      RETURNING id, email, name, created_at
    `

    return NextResponse.json({
      success: true,
      user: result[0]
    })
  } catch (error) {
    console.error('Failed to create user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
