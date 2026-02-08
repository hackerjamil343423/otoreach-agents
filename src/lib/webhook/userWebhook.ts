/**
 * User Webhook Service
 * 
 * Handles sending file data to user-configured webhooks when files are created or updated.
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
    storage_path: string
  }
  project?: { id: string; name: string }
  sub_project?: { id: string; name: string }
}

interface FileMetadata {
  id: string
  name: string
  description?: string
  file_type: string
  size_bytes: number
  storage_path: string
  sub_project_id: string
  user_id: string
}

interface ProjectInfo {
  project_id: string
  project_name: string
  sub_project_name: string
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
 * Get file metadata including project info
 */
async function getFileMetadata(fileId: string): Promise<(FileMetadata & ProjectInfo) | null> {
  try {
    const result = await sql`
      SELECT 
        pf.id,
        pf.name,
        pf.description,
        pf.file_type,
        pf.size_bytes,
        pf.supabase_storage_path as storage_path,
        pf.sub_project_id,
        sp.name as sub_project_name,
        sp.project_id,
        p.name as project_name,
        p.user_id
      FROM project_files pf
      JOIN sub_projects sp ON pf.sub_project_id = sp.id
      JOIN projects p ON sp.project_id = p.id
      WHERE pf.id = ${fileId}
    `
    return result[0] as (FileMetadata & ProjectInfo) || null
  } catch (error) {
    console.error('Failed to get file metadata:', error)
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
  event: 'file.created' | 'file.updated'
): Promise<{ success: boolean; error?: string }> {
  // Get webhook URL
  const webhookUrl = await getUserWebhookUrl(userId)
  if (!webhookUrl) {
    // No webhook configured, silently skip
    return { success: true }
  }

  // Get file metadata
  const metadata = await getFileMetadata(fileId)
  if (!metadata) {
    return { success: false, error: 'File not found' }
  }

  // Build payload
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    user_id: userId,
    file: {
      id: fileId,
      name: metadata.name,
      description: metadata.description,
      content,
      file_type: metadata.file_type,
      size_bytes: metadata.size_bytes,
      project_id: metadata.project_id,
      sub_project_id: metadata.sub_project_id,
      storage_path: metadata.storage_path
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
          'X-Webhook-Attempt': attempt.toString()
        },
        body: JSON.stringify(payload),
        // 30 second timeout
        signal: AbortSignal.timeout(30000)
      })

      if (response.ok) {
        console.log(`Webhook sent successfully for file ${fileId} (${event}, attempt ${attempt})`)
        return { success: true }
      }

      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Webhook attempt ${attempt} failed for file ${fileId}:`, lastError.message)

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
