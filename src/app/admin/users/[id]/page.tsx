'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Agent, User } from '@/lib/types/admin'
import { ArrowLeft, Bot, Key, Loader2, Users, Settings } from 'lucide-react'
import { UserIntegrations } from '@/components/admin/UserIntegrations'

interface UserWithAgents extends User {
  agents?: Agent[]
}

export default function EditUserPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [user, setUser] = useState<UserWithAgents | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch user')
        }

        setUser(data.user)
        setAgents(data.assignedAgents || [])
        setFormData({
          name: data.user.name || '',
          email: data.user.email,
          password: ''
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user')
        console.error('Fetch user error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const updateData: { name: string; email: string; password?: string } = {
        name: formData.name,
        email: formData.email
      }

      if (formData.password) {
        updateData.password = formData.password
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to update user')
      }

      router.push('/admin/users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-primary size-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{error || 'User not found'}</p>
        <Link href="/admin/users" className="mt-4 inline-block">
          <Button>Back to Users</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href="/admin/users"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-2 size-4" />
        Back to Users
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{user.name || user.email}</h1>
        <p className="text-muted-foreground mt-1">{user.email}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
      )}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Users className="size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Key className="size-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="size-4" />
            Agents ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Settings className="size-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update user account details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Change user password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <p className="text-muted-foreground text-sm">
                    Leave blank to keep current password
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      disabled={saving}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={saving}
                      className="shrink-0"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={saving || !formData.password}>
                    {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Update Password
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFormData({ ...formData, password: '' })
                      setShowPassword(false)
                    }}
                    disabled={saving}
                  >
                    Clear
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-5" />
                  Agent Access
                </CardTitle>
                <CardDescription>Manage agents available to this user</CardDescription>
              </CardHeader>
              <CardContent>
                {agents.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bot className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
                    <h3 className="text-lg font-semibold">No agents assigned</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      This user doesn&apos;t have access to any agents yet
                    </p>
                    <Link href={`/admin/agents?user_id=${userId}`}>
                      <Button className="mt-4">Assign Agents</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {agents.map((agent) => (
                      <Card key={agent.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="bg-primary/10 rounded-lg p-1.5">
                                <Bot className="text-primary size-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium">{agent.name}</h4>
                                {agent.description && (
                                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                                    {agent.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          {agent.is_global ? (
                            <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-700">
                              Global
                            </span>
                          ) : (
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                              Private
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2 border-t pt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => (window.location.href = `/admin/agents/${agent.id}`)}
                            className="flex-1"
                          >
                            Edit Agent
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage all agents or assign new ones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href={`/admin/agents?user_id=${userId}`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Bot className="mr-2 size-4" />
                    View All Agents
                  </Button>
                </Link>
                <Link href={`/admin/agents/new`}>
                  <Button className="w-full justify-start">
                    <Users className="mr-2 size-4" />
                    Create New Agent
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <UserIntegrations userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
