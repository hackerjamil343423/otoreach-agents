/**
 * Shared Admin Types
 *
 * Central type definitions for admin panel components and API routes.
 */

export interface Agent {
  id: string
  name: string
  description: string | null
  system_prompt: string
  webhook_url: string | null
  is_active: boolean
  is_global: boolean
  category: string | null
  assigned_to: string[] // Array of user IDs who can access this agent
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  email_verified: boolean
  created_at: string
  updated_at: string
}

export interface AgentFormData {
  name: string
  description: string
  system_prompt: string
  webhook_url: string
  is_active: boolean
  is_global: boolean
  category: string | null
  assigned_to?: string[]
}

export interface UserWithAgents extends User {
  agents?: Agent[]
  agent_count?: number
}

export interface UserSelectOption {
  value: string
  label: string
  email: string
}
