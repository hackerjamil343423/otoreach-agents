'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AgentForm } from '@/components/admin/AgentForm'
import { UserMultiSelect } from '@/components/admin/UserMultiSelect'
import type { AgentFormData, UserSelectOption } from '@/lib/types/admin'
import { ArrowLeft } from 'lucide-react'

export default function NewAgentPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserSelectOption[]>([])
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
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
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
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  const handleSubmit = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create agent')
      }

      router.push('/admin/agents')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back link */}
      <Link
        href="/admin/agents"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-2 size-4" />
        Back to Agents
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Create New Agent</h1>
        <p className="text-muted-foreground mt-1">
          Configure an AI agent with a custom system prompt and webhook
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
      )}

      <AgentForm
        data={formData}
        onChange={setFormData}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        isLoading={saving}
        submitLabel="Create Agent"
      />

      {formData.is_global && (
        <UserMultiSelect
          users={users}
          selectedIds={formData.assigned_to || []}
          onChange={(ids) => setFormData({ ...formData, assigned_to: ids })}
          disabled={saving || loadingUsers}
        />
      )}
    </div>
  )
}
