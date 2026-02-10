/**
 * User Webhook Service
 *
 * Handles sending file data to user-configured webhooks when files are created or updated.
 * No Supabase dependency - only Neon DB + webhook.
 */

import { sql } from '@/lib/db'

export interface WebhookPayload {
  event: 'file.created' | 'file.updated'
  timestamp: string
  user_id: string
  file: {
    id: string
    name: string
    description?: string
    content: string
    file_type: string
    size_bytes: number
    project_id?: string
    sub_project_id?: string
    category?: string | null
    sub_category?: string | null
  }
  project?: { id: string; name: string }
  sub_project?: { id: string; name: string }
}

interface WebhookMetadata {
  project_id: string
  project_name: string
  sub_project_id: string
  sub_project_name: string
  file_name: string
  file_type: string
  category?: string
  sub_category?: string
}

/**
 * Get webhook URL for a user
 */
export async function getUserWebhookUrl(userId: string): Promise<string | null> {
  try {
    const result = await sql`
      SELECT webhook_url FROM users WHERE id = ${userId}
    `
    return result[0]?.webhook_url || null
  } catch (error) {
    console.error('Failed to get user webhook URL:', error)
    return null
  }
}

/**
 * Send file data to user's webhook with retry logic
 */
export async function sendFileToWebhook(
  userId: string,
  fileId: string,
  content: string,
  event: 'file.created' | 'file.updated',
  metadata?: WebhookMetadata
): Promise<{ success: boolean; error?: string }> {
  console.log('[sendFileToWebhook] Starting:', { userId, fileId, event, metadata })

  // Get webhook URL
  const webhookUrl = await getUserWebhookUrl(userId)
  if (!webhookUrl) {
    // No webhook configured, silently skip
    console.log('[sendFileToWebhook] No webhook URL configured for user:', userId)
    return { success: true }
  }

  console.log('[sendFileToWebhook] Webhook URL found:', webhookUrl)

  // Build payload with metadata or fetch from database
  let payload: WebhookPayload

  if (metadata) {
    // Use provided metadata
    payload = {
      event,
      timestamp: new Date().toISOString(),
      user_id: userId,
      file: {
        id: fileId,
        name: metadata.file_name,
        content,
        file_type: metadata.file_type,
        size_bytes: content.length,
        project_id: metadata.project_id,
        sub_project_id: metadata.sub_project_id,
        category: metadata.category || null,
        sub_category: metadata.sub_category || null
      },
      project: {
        id: metadata.project_id,
        name: metadata.project_name
      },
      sub_project: {
        id: metadata.sub_project_id,
        name: metadata.sub_project_name
      }
    }
  } else {
    // Fetch from database
    const fileData = await sql`
      SELECT
        pf.id,
        pf.name,
        pf.description,
        pf.file_type,
        pf.size_bytes,
        pf.sub_project_id,
        sp.name as sub_project_name,
        sp.project_id,
        p.name as project_name
      FROM project_files pf
      JOIN sub_projects sp ON pf.sub_project_id = sp.id
      JOIN projects p ON sp.project_id = p.id
      WHERE pf.id = ${fileId}
    `

    if (fileData.length === 0) {
      return { success: false, error: 'File not found' }
    }

    const file = fileData[0] as Record<string, unknown>
    payload = {
      event,
      timestamp: new Date().toISOString(),
      user_id: userId,
      file: {
        id: fileId,
        name: file.name as string,
        description: file.description as string | undefined,
        content,
        file_type: file.file_type as string,
        size_bytes: content.length,
        project_id: file.project_id as string,
        sub_project_id: file.sub_project_id as string
      },
      project: {
        id: file.project_id as string,
        name: file.project_name as string
      },
      sub_project: {
        id: file.sub_project_id as string,
        name: file.sub_project_name as string
      }
    }
  }

  console.log('[sendFileToWebhook] Sending payload:', JSON.stringify(payload, null, 2))

  // Send with retry logic
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Attempt': attempt.toString(),
          'X-Webhook-User-Id': userId,
          'X-Webhook-File-Id': fileId
        },
        body: JSON.stringify(payload),
        // 30 second timeout
        signal: AbortSignal.timeout(30000)
      })

      if (response.ok) {
        console.log(`[sendFileToWebhook] Webhook sent successfully for file ${fileId} (${event}, attempt ${attempt})`)
        return { success: true }
      }

      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[sendFileToWebhook] Attempt ${attempt} failed for file ${fileId}:`, lastError.message)

      // Don't retry on 4xx errors (client errors)
      if (lastError.message.includes('HTTP 4')) {
        return { success: false, error: lastError.message }
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  console.error(`[sendFileToWebhook] Failed after ${maxRetries} attempts for file ${fileId}`)
  return {
    success: false,
    error: `Failed after ${maxRetries} attempts: ${lastError?.message}`
  }
}

/**
 * Test webhook URL by sending a ping event
 */
export async function testWebhookUrl(webhookUrl: string): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number
}> {
  try {
    // Validate URL format
    new URL(webhookUrl)

    const startTime = Date.now()
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'ping'
      },
      body: JSON.stringify({
        event: 'ping',
        timestamp: new Date().toISOString(),
        message: 'Webhook test from OTO Reach'
      }),
      signal: AbortSignal.timeout(10000)
    })
    const responseTime = Date.now() - startTime

    if (response.ok) {
      return { success: true, responseTime }
    }

    const errorText = await response.text().catch(() => 'Unknown error')
    return {
      success: false,
      error: `HTTP ${response.status}: ${errorText}`,
      responseTime
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return { success: false, error: 'Invalid URL format' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
