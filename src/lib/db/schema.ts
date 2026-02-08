/**
 * Database Schema Type Definitions
 *
 * TypeScript interfaces for all database tables
 */

/**
 * Message content types
 */
export interface MessageContent {
  text?: string
  image?: string
  document?: {
    name: string
    type: string
    content: string
    size?: string
  }
  // Additional fields can be added as needed
  [key: string]: unknown
}

export interface User {
  id: string
  email: string
  password_hash: string | null
  name: string | null
  avatar_url: string | null
  email_verified: boolean
  created_at: Date
  updated_at: Date
}

export interface Persona {
  id: string
  user_id: string
  name: string
  description: string | null
  system_prompt: string
  is_default: boolean
  created_at: Date
  updated_at: Date
}

export interface Chat {
  id: string
  user_id: string
  persona_id: string | null
  title: string
  session_id: string | null
  created_at: Date
  updated_at: Date
}

export interface Message {
  id: string
  chat_id: string
  role: 'user' | 'assistant' | 'system'
  content: MessageContent // JSONB content for messages (text, images, documents)
  created_at: Date
}

export interface Session {
  id: string
  user_id: string
  token: string
  expires_at: Date
  created_at: Date
}

// Admin User (for admin panel authentication)
export interface AdminUser {
  id: string
  email: string
  password_hash: string
  name: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// Agent (configurable AI agent with custom webhook)
// user_id is NULL for global agents, set to a user ID for user-specific agents
export interface Agent {
  id: string
  name: string
  description: string | null
  system_prompt: string
  webhook_url: string | null
  is_active: boolean
  user_id: string | null // null = global agent, set = user-specific agent
  created_at: Date
  updated_at: Date
}

// User-Agent assignment (which agents are available to which users)
export interface UserAgent {
  id: string
  user_id: string
  agent_id: string
  is_default: boolean
  created_at: Date
}

// Type for creating a new user (without id, timestamps)
export type NewUser = Omit<User, 'id' | 'created_at' | 'updated_at'>

// Type for creating a new persona (without id, timestamps)
export type NewPersona = Omit<Persona, 'id' | 'created_at' | 'updated_at'>

// Type for creating a new chat (without id, timestamps)
export type NewChat = Omit<Chat, 'id' | 'created_at' | 'updated_at'>

// Type for creating a new message (without id, created_at)
export type NewMessage = Omit<Message, 'id' | 'created_at'>

// Type for creating a new admin user (without id, timestamps)
export type NewAdminUser = Omit<AdminUser, 'id' | 'created_at' | 'updated_at'>

// Type for creating a new agent (without id, timestamps)
export type NewAgent = Omit<Agent, 'id' | 'created_at' | 'updated_at'>

// Extended type for creating a user-specific agent
export type NewUserSpecificAgent = NewAgent & { user_id: string }

// Type for creating a new user-agent assignment (without id, created_at)
export type NewUserAgent = Omit<UserAgent, 'id' | 'created_at'>
