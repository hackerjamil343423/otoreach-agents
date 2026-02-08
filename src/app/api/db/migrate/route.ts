import { NextResponse } from 'next/server'
import { runMigrations } from '@/lib/db/migrations'

export async function POST() {
  try {
    await runMigrations()
    return NextResponse.json({ success: true, message: 'Migrations completed' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to run migrations'
  })
}
