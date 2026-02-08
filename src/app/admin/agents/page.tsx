'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AgentCard } from '@/components/admin/AgentCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { Agent } from '@/lib/types/admin'
import { Bot, Globe, Plus, Search, Sparkles, User } from 'lucide-react'

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'global' | 'user-specific'>('all')

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/admin/agents')
      const data = await response.json()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/agents/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAgents(agents.filter((a) => a.id !== id))
      } else {
        alert('Failed to delete agent')
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
      alert('Failed to delete agent')
    }
  }

  const handleToggleActive = async (id: string) => {
    const agent = agents.find((a) => a.id === id)
    if (!agent) return

    try {
      const response = await fetch(`/api/admin/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !agent.is_active })
      })

      if (response.ok) {
        setAgents(agents.map((a) => (a.id === id ? { ...a, is_active: !agent.is_active } : a)))
      } else {
        alert('Failed to update agent')
      }
    } catch (error) {
      console.error('Failed to update agent:', error)
      alert('Failed to update agent')
    }
  }

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.description?.toLowerCase().includes(search.toLowerCase())

    const matchesFilter =
      filter === 'all' ||
      (filter === 'global' && agent.is_global) ||
      (filter === 'user-specific' && !agent.is_global)

    return matchesSearch && matchesFilter
  })

  // Count agent types
  const globalCount = agents.filter((a) => a.is_global).length
  const userSpecificCount = agents.filter((a) => !a.is_global).length
  const activeCount = agents.filter((a) => a.is_active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Sparkles className="text-primary size-6" />
            <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          </div>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Agents are AI assistants with custom behaviors. Global agents are available to all
            assigned users, while private agents are restricted to specific users.
          </p>
        </div>
        <Link href="/admin/agents/new">
          <Button size="lg">
            <Plus className="mr-2 size-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Bot className="text-primary size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Total Agents</p>
              <p className="text-2xl font-bold">{agents.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <Sparkles className="size-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <Globe className="size-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Global</p>
              <p className="text-2xl font-bold">{globalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <User className="size-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Private</p>
              <p className="text-2xl font-bold">{userSpecificCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(value: 'all' | 'global' | 'user-specific') => setFilter(value)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Badge variant="outline">All</Badge>
                <span className="ml-2">All Agents ({agents.length})</span>
              </div>
            </SelectItem>
            <SelectItem value="global">
              <div className="flex items-center gap-2">
                <Globe className="size-3 text-purple-600" />
                <span>Global ({globalCount})</span>
              </div>
            </SelectItem>
            <SelectItem value="user-specific">
              <div className="flex items-center gap-2">
                <User className="size-3 text-blue-600" />
                <span>Private ({userSpecificCount})</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="border-primary mb-4 h-10 w-10 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <div className="bg-muted mb-4 inline-flex items-center justify-center rounded-full p-4">
            <Bot className="text-muted-foreground h-10 w-10" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">
            {search ? 'No matching agents found' : 'No agents yet'}
          </h3>
          <p className="text-muted-foreground mx-auto mb-6 max-w-md">
            {search
              ? `Try adjusting your search or filter. There are ${agents.length} agents total.`
              : 'Create your first AI agent to get started. Agents can be global (available to all users) or private (assigned to specific users).'}
          </p>
          {search && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setFilter('all')
              }}
              className="mr-3"
            >
              Clear Filters
            </Button>
          )}
          <Link href="/admin/agents/new">
            <Button>
              <Plus className="mr-2 size-4" />
              Create Agent
            </Button>
          </Link>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Showing {filteredAgents.length} of {agents.length} agents
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onToggleActive={handleToggleActive}
                onEdit={(id) => (window.location.href = `/admin/agents/${id}`)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
