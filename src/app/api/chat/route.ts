import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { validateSession } from '@/lib/auth/session'
import { sql } from '@/lib/db'
import { v4 as uuid } from 'uuid'

/**
 * OTO Reach Agents webhook endpoint
 * Uses user's assigned agents with custom webhooks
 * Sends input (text only), context (category/sub-project), session ID, system prompt, and agent info
 */
async function forwardToAgentWebhook(
  input: string,
  webhookUrl: string,
  sessionId: string,
  context?: {
    category?: string
    sub_category?: string
    sub_project_name?: string
    project_id?: string
    sub_project_id?: string
  },
  systemPrompt?: string | null,
  agentName?: string | null,
  agentCategory?: string | null,
  projectContext?: string | null
) {
  if (!webhookUrl) {
    throw new Error('Agent webhook URL not configured')
  }

  const payload: {
    session_id: string
    input: string
    category?: string
    sub_category?: string
    sub_project_name?: string
    project_id?: string
    sub_project_id?: string
    system_prompt?: string
    agent_name?: string
    agent_category?: string
    context?: string
  } = {
    session_id: sessionId,
    input
  }

  // Include agent category if available (takes priority over context category)
  if (agentCategory) {
    payload.category = agentCategory
  } else if (context?.category) {
    payload.category = context.category
  }
  if (context?.sub_category) {
    payload.sub_category = context.sub_category
  }
  if (context?.sub_project_name) {
    payload.sub_project_name = context.sub_project_name
  }
  if (context?.project_id) {
    payload.project_id = context.project_id
  }
  if (context?.sub_project_id) {
    payload.sub_project_id = context.sub_project_id
  }

  // Include system prompt if available
  if (systemPrompt) {
    payload.system_prompt = systemPrompt
  }

  // Include agent name if available
  if (agentName) {
    payload.agent_name = agentName
  }

  // Include project context if available
  if (projectContext) {
    payload.context = projectContext
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Agent webhook returned ${response.status}: ${response.statusText}`)
  }

  return response
}

// Context type for category and sub-project selection
interface ChatContext {
  category?: string
  sub_category?: string
  sub_project_name?: string
  project_id?: string
  sub_project_id?: string
}

export async function POST(req: NextRequest) {
  try {
    const { input, context, agentId, chatId } = (await req.json()) as {
      input: string
      context?: ChatContext
      agentId?: string
      chatId?: string
    }

    // Verify user is authenticated via cookie (preferred) or email header (fallback)
    const token = req.cookies.get('auth_token')?.value
    const userEmail = req.headers.get('x-user-email')

    let user: { id: string; email: string; name: string | null } | null = null

    if (token) {
      // Validate session from cookie
      const sessionResult = await validateSession(token)
      if (sessionResult.valid && sessionResult.payload) {
        // Get user from database
        const userResult = await sql`
          SELECT id, email, name FROM users WHERE id = ${sessionResult.payload.userId}
        `
        if (userResult.length > 0 && userResult[0]) {
          user = userResult[0] as { id: string; email: string; name: string | null }
        }
      }
    } else if (userEmail) {
      user = await getCurrentUser(userEmail)
    }

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Default webhook from environment
    let webhookUrl = process.env.AGENT_WEBHOOK_URL || ''
    let systemPrompt: string | null = null
    let agentName: string | null = null
    let agentCategory: string | null = null

    // If agentId is provided, try to get its webhook and verify access
    if (agentId) {
      try {
        // Get agent and verify user has access (global agents or user-specific agents)
        const result = await sql`
          SELECT webhook_url, system_prompt, name, category
          FROM agents
          WHERE id = ${agentId}
            AND is_active = true
            AND (user_id IS NULL OR user_id = ${user.id})
        `
        if (result.length > 0 && result[0]) {
          if (result[0].webhook_url) {
            webhookUrl = result[0].webhook_url
          }
          systemPrompt = result[0].system_prompt
          agentName = result[0].name
          agentCategory = result[0].category
        } else {
          throw new Error('Agent not found or access denied')
        }
      } catch (dbError) {
        console.error('Failed to fetch agent:', dbError)
        throw new Error('Agent not found or access denied')
      }
    }

    if (!webhookUrl) {
      throw new Error(
        'AGENT_WEBHOOK_URL not configured. Please set the environment variable or assign an agent with a webhook.'
      )
    }

    // Get session_id from the chat
    let sessionId: string
    let projectContext: string | null = null

    if (chatId) {
      // Verify chat belongs to user and get session_id
      const chatResult = await sql`
        SELECT session_id, user_id FROM chats WHERE id = ${chatId}
      `
      if (chatResult.length === 0) {
        throw new Error('Chat not found')
      }
      const chat = chatResult[0]!
      if (chat.user_id !== user.id) {
        throw new Error('Unauthorized access to chat')
      }
      sessionId = chat.session_id!
      if (!sessionId) {
        // Generate session_id if it doesn't exist
        sessionId = uuid()
        await sql`
          UPDATE chats SET session_id = ${sessionId} WHERE id = ${chatId}
        `
      }

      // Check for linked project and get context
      try {
        const projectLink = await sql`
          SELECT p.id, p.name, sp.name as sub_project_name, pf.name as file_name, pf.id as file_id
          FROM chat_project_links cpl
          JOIN projects p ON p.id = cpl.project_id
          JOIN sub_projects sp ON sp.project_id = p.id
          JOIN project_files pf ON pf.sub_project_id = sp.id
          WHERE cpl.chat_id = ${chatId}
          LIMIT 1
        `

        if (projectLink.length > 0 && projectLink[0]) {
          // Load file content from user's Supabase
          const { loadFile } = await import('@/lib/supabase/files')
          try {
            const link = projectLink[0]!
            const fileContent = await loadFile(user.id, link.file_id)
            projectContext = `Project Context: ${link.name} / ${link.sub_project_name} / ${link.file_name}\n\n${fileContent.content}`
          } catch (error) {
            console.error('Failed to load project file:', error)
            // Continue without project context if there's an error
          }
        }
      } catch (error) {
        console.error('Failed to check project link:', error)
        // Continue without project context if there's an error
      }
    } else {
      // Create a new chat with session_id
      sessionId = uuid()
      const now = new Date().toISOString()
      const newChat = await sql`
        INSERT INTO chats (id, user_id, title, session_id, created_at, updated_at)
        VALUES (${uuid()}, ${user.id}, 'New Chat', ${sessionId}, ${now}, ${now})
        RETURNING id
      `
      // Return the new chat ID in the response headers for the frontend
      if (newChat[0]?.id) {
        req.headers.set('x-new-chat-id', newChat[0].id)
      }
    }

    // Save user message to database
    if (chatId) {
      const now = new Date().toISOString()
      await sql`
        INSERT INTO messages (id, chat_id, role, content, created_at)
        VALUES (${uuid()}, ${chatId}, 'user', ${JSON.stringify(input)}, ${now})
      `
      // Update chat's updated_at
      await sql`
        UPDATE chats SET updated_at = ${now} WHERE id = ${chatId}
      `
    }

    // Forward to agent webhook with input (text only), context (category/sub-project), session_id, system prompt, agent name, agent category, and project context
    const response = await forwardToAgentWebhook(
      input,
      webhookUrl,
      sessionId,
      context,
      systemPrompt,
      agentName,
      agentCategory,
      projectContext
    )

    // Get the response content
    const responseText = await response.text()

    // Parse JSON and extract output if it's a JSON response
    let outputText = responseText
    try {
      const jsonResponse = JSON.parse(responseText)
      if (jsonResponse.output) {
        outputText = jsonResponse.output
      }
    } catch {
      // Response is not JSON, use as-is
      outputText = responseText
    }

    // Save assistant message to database
    if (chatId && response.ok) {
      const now = new Date().toISOString()
      await sql`
        INSERT INTO messages (id, chat_id, role, content, created_at)
        VALUES (${uuid()}, ${chatId}, 'assistant', ${JSON.stringify(outputText)}, ${now})
      `
      await sql`
        UPDATE chats SET updated_at = ${now} WHERE id = ${chatId}
      `
    }

    // Return the response stream
    return new Response(outputText, {
      status: response.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Session-ID': sessionId
      }
    })
  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
