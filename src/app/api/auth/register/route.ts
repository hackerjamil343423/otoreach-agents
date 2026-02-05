import { NextResponse } from 'next/server'

export async function POST() {
  // Self-registration is disabled - users must be created by admin
  return NextResponse.json(
    {
      error:
        'Self-registration is not allowed. Please contact your administrator to create an account.'
    },
    { status: 403 }
  )
}
