'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AgentForm } from '@/components/admin/AgentForm'
import { UserMultiSelect } from '@/components/admin/UserMultiSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Agent, AgentFormData, UserSelectOption } from '@/lib/types/admin'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Globe,
  Loader2,
  Sparkles,
  Tag,
  Trash2,
  Users
} from 'lucide-react'

export default function EditAgentPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string

  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    system_prompt: '',
    webhook_url: '',
    is_active: true,
    is_global: true,
    category: null,
    assigned_to: []
  })
  const [agent, setAgent] = useState<Agent | null>(null)
  const [users, setUsers] = useState<UserSelectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    Promise.all([fetchAgent(), fetchUsers()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId])

  const fetchAgent = async () => {
    try {
      const response = await fetch(`/api/admin/agents/${agentId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch agent')
      }

      setAgent(data.agent)
      setFormData({
        name: data.agent.name,
        description: data.agent.description || '',
        system_prompt: data.agent.system_prompt,
        webhook_url: data.agent.webhook_url || '',
        is_active: data.agent.is_active,
        is_global: data.agent.is_global,
        category: data.agent.category || null,
        assigned_to: data.agent.assigned_to || []
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      const userOptions = (data.users || []).map(
        (u: { id: string; name?: string; email: string }) => ({
          value: u.id,
          label: u.name || u.email,
          email: u.email
        })
      )
      setUsers(userOptions)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update agent')
      }

      // Refetch agent to get updated data
      await fetchAgent()
      setError('')
      // Show success feedback
      setTimeout(() => router.push('/admin/agents'), 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }

    if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/agents/${agentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push('/admin/agents')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete agent')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="text-primary mx-auto mb-4 size-12 animate-spin" />
          <p className="text-muted-foreground">Loading agent...</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="text-destructive mx-auto mb-4 size-12" />
            <h3 className="mb-2 text-lg font-semibold">Agent Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The agent you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
            <Link href="/admin/agents">
              <Button>Back to Agents</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16">
      <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/agents"
            className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm transition-colors"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back to Agents
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className={`rounded-xl p-3 ${agent.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                <Sparkles
                  className={`size-6 ${agent.is_active ? 'text-primary' : 'text-muted-foreground'}`}
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
                  <Badge variant={agent.is_active ? 'default' : 'secondary'} className="gap-1.5">
                    <span
                      className={`size-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-gray-400'}`}
                    />
                    {agent.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    {agent.is_global ? (
                      <>
                        <Globe className="size-3 text-purple-600" />
                        Global
                      </>
                    ) : (
                      <>
                        <Users className="size-3 text-blue-600" />
                        Private
                      </>
                    )}
                  </Badge>
                  {agent.category && (
                    <Badge variant="outline" className="gap-1.5">
                      <Tag className="size-3 text-orange-600" />
                      {agent.category}
                    </Badge>
                  )}
                </div>
                {agent.description && (
                  <p className="text-muted-foreground mt-2 max-w-2xl">{agent.description}</p>
                )}
                <div className="text-muted-foreground mt-3 flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    Created {format(new Date(agent.created_at), 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    Updated {format(new Date(agent.updated_at), 'MMM d, yyyy')}
                  </div>
                  {agent.is_global && (
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {agent.assigned_to?.length || 0} user
                      {(agent.assigned_to?.length || 0) !== 1 ? 's' : ''} assigned
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border-destructive/20 mb-6 rounded-lg border p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="settings" className="gap-2">
              <Sparkles className="size-4" />
              Settings
            </TabsTrigger>
            {agent.is_global && (
              <TabsTrigger value="users" className="gap-2">
                <Users className="size-4" />
                Assigned Users ({agent.assigned_to?.length || 0})
              </TabsTrigger>
            )}
            <TabsTrigger
              value="danger"
              className="text-destructive data-[state=active]:text-destructive gap-2"
            >
              <AlertTriangle className="size-4" />
              Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Configuration</CardTitle>
                <CardDescription>
                  Configure your AI agent settings, behavior, and integration options.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AgentForm
                  data={formData}
                  onChange={setFormData}
                  onSubmit={handleSubmit}
                  onCancel={() => router.back()}
                  isLoading={saving}
                  submitLabel="Save Changes"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          {agent.is_global && (
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Assign Users</CardTitle>
                  <CardDescription>
                    Select which users can access this global agent. Unassigned users will not see
                    this agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UserMultiSelect
                    users={users}
                    selectedIds={formData.assigned_to || []}
                    onChange={(ids) => setFormData({ ...formData, assigned_to: ids })}
                    disabled={saving}
                  />
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSubmit} disabled={saving}>
                      {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Save Assignment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Assigned Users List */}
              {(formData.assigned_to?.length || 0) > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Currently Assigned Users</CardTitle>
                    <CardDescription>
                      {formData.assigned_to?.length || 0} user
                      {(formData.assigned_to?.length || 0) !== 1 ? 's' : ''} have access to this
                      agent
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {formData.assigned_to?.map((userId) => {
                        const user = users.find((u) => u.value === userId)
                        return user ? (
                          <div
                            key={userId}
                            className="bg-muted/30 flex items-center justify-between rounded-lg border p-3"
                          >
                            <div>
                              <p className="font-medium">{user.label}</p>
                              <p className="text-muted-foreground text-sm">{user.email}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  assigned_to:
                                    formData.assigned_to?.filter((id) => id !== userId) || []
                                })
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ) : null
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* Danger Zone Tab */}
          <TabsContent value="danger" className="space-y-6">
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible and destructive actions. Please be careful.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-semibold">Delete Agent</h4>
                      <p className="text-muted-foreground text-sm">
                        Permanently delete this agent and remove access from all assigned users.
                        This action cannot be undone.
                      </p>
                    </div>
                    <Button variant="destructive" onClick={handleDelete}>
                      {deleteConfirm ? (
                        <>Confirm Delete</>
                      ) : (
                        <>
                          <Trash2 className="mr-2 size-4" />
                          Delete Agent
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
