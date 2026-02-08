import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS session_id VARCHAR(255)`
    return NextResponse.json({ success: true, message: 'session_id column added' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
