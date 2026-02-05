'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowRight, BarChart3, Bot, MessageSquare, Plus, Users } from 'lucide-react'

interface Stats {
  users: number
  agents: number
  chats: number
}

interface DashboardCard {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  action: string
  color: string
}

const cards: DashboardCard[] = [
  {
    title: 'Users',
    description: 'Manage client accounts',
    href: '/admin/users',
    icon: Users,
    action: 'Manage Users',
    color: 'text-blue-500 bg-blue-50'
  },
  {
    title: 'Agents',
    description: 'Configure AI agents',
    href: '/admin/agents',
    icon: Bot,
    action: 'Manage Agents',
    color: 'text-purple-500 bg-purple-50'
  }
]

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ users: 0, agents: 0, chats: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, agentsRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/agents')
        ])

        const usersData = await usersRes.json()
        const agentsData = await agentsRes.json()

        setStats({
          users: usersData.users?.length || 0,
          agents: agentsData.agents?.length || 0,
          chats: 0 // Add chat count if needed
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total Users</p>
              <p className="mt-1 text-3xl font-bold">{stats.users}</p>
            </div>
            <div className="rounded-full bg-blue-50 p-3">
              <Users className="size-6 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total Agents</p>
              <p className="mt-1 text-3xl font-bold">{stats.agents}</p>
            </div>
            <div className="rounded-full bg-purple-50 p-3">
              <Bot className="size-6 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Active Chats</p>
              <p className="mt-1 text-3xl font-bold">{stats.chats}</p>
            </div>
            <div className="rounded-full bg-green-50 p-3">
              <MessageSquare className="size-6 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.href}
            className="bg-card rounded-lg border p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={cn('rounded-lg p-3', card.color)}>
                  <card.icon className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className="text-muted-foreground text-sm">{card.description}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Link href={card.href}>
                <Button variant="outline" className="w-full">
                  {card.action}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="bg-muted/50 rounded-lg border p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="size-5" />
          <h3 className="font-semibold">Quick Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/users/new">
            <Button size="sm" variant="outline">
              <Plus className="mr-2 size-4" />
              New User
            </Button>
          </Link>
          <Link href="/admin/agents/new">
            <Button size="sm" variant="outline">
              <Plus className="mr-2 size-4" />
              New Agent
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
