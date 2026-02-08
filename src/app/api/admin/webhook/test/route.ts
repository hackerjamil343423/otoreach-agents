import { NextRequest, NextResponse } from 'next/server'
import { testWebhookUrl } from '@/lib/webhook/userWebhook'
import { validateAdminSession } from '@/lib/auth/admin-session'

export const runtime = 'edge'

// POST /api/admin/webhook/test - Test a webhook URL
export async function POST(req: NextRequest) {
  try {
    // Validate admin authentication
    const token = req.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminValidation = await validateAdminSession(token)
    if (!adminValidation.valid) {
      return NextResponse.json(
        { error: adminValidation.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const { webhook_url } = await req.json()

    if (!webhook_url) {
      return NextResponse.json(
        { error: 'webhook_url is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(webhook_url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Test the webhook
    const result = await testWebhookUrl(webhook_url)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Webhook test successful',
        responseTime: result.responseTime
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Webhook test failed'
      }, { status: 422 })
    }
  } catch (error) {
    console.error('Webhook test error:', error)
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    )
  }
}
