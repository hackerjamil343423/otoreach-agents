import { NextRequest } from 'next/server'

export const runtime = 'edge'

/**
 * OTO Reach Agents webhook endpoint
 * This will be connected to your agent webhooks
 */
async function forwardToAgentWebhook(messages: any[], input: any) {
  // TODO: Configure your agent webhook URL here
  const webhookUrl = process.env.AGENT_WEBHOOK_URL || ''

  if (!webhookUrl) {
    throw new Error('AGENT_WEBHOOK_URL not configured. Please set the environment variable.')
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      input
    })
  })

  if (!response.ok) {
    throw new Error(`Agent webhook returned ${response.status}: ${response.statusText}`)
  }

  return response
}

type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | {
          type: 'document'
          name: string
          content: string
          mimeType: string
          images?: Array<{
            pageNumber: number
            name: string
            width: number
            height: number
            dataUrl: string
          }>
        }
    >

type ChatCompletionMessage = {
  role: 'assistant' | 'user' | 'system'
  content: MessageContent
}

export async function POST(req: NextRequest) {
  try {
    const { messages, input } = (await req.json()) as {
      messages: ChatCompletionMessage[]
      input: MessageContent
    }

    // Forward to agent webhook
    const response = await forwardToAgentWebhook(messages, input)

    // Return the response stream
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        'Transfer-Encoding': 'chunked'
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
