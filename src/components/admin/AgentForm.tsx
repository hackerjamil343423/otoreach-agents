'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { type AgentFormData } from '@/lib/types/admin'
import { useAdminUserCategories } from '@/hooks/useAdminUserCategories'
import { Loader2, Tag, User } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string | null
}

interface AgentFormProps {
  data: AgentFormData
  onChange: (data: AgentFormData) => void
  onSubmit: () => void
  onCancel: () => void
  isLoading?: boolean
  submitLabel?: string
}

export function AgentForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Save Agent'
}: AgentFormProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)

  // Fetch categories based on selected user
  const { categories, loading: categoriesLoading, error: categoriesError } = useAdminUserCategories(selectedUserId, { autoFetch: true })

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true)
      try {
        const res = await fetch('/api/admin/users')
        const data = await res.json()
        setUsers(data.users || [])
      } catch (err) {
        console.error('Failed to fetch users:', err)
      } finally {
        setUsersLoading(false)
      }
    }
    void fetchUsers()
  }, [])

  // Clear category when user changes
  useEffect(() => {
    if (selectedUserId) {
      onChange({ ...data, category: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId])

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Agent Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Customer Support Bot"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            placeholder="Brief description of what this agent does"
            value={data.description}
            onChange={(e) => onChange({ ...data, description: e.target.value })}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="system_prompt">System Prompt *</Label>
          <Textarea
            id="system_prompt"
            placeholder="You are a helpful assistant that..."
            value={data.system_prompt}
            onChange={(e) => onChange({ ...data, system_prompt: e.target.value })}
            disabled={isLoading}
            required
            rows={6}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhook_url">Webhook URL</Label>
          <Input
            id="webhook_url"
            type="url"
            placeholder="https://your-webhook-url.com/endpoint"
            value={data.webhook_url}
            onChange={(e) => onChange({ ...data, webhook_url: e.target.value })}
            disabled={isLoading}
          />
        </div>

        {/* User and Category Selection Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* User Selector */}
          <div className="space-y-2">
            <Label htmlFor="category-user">User for Category *</Label>
            <Select
              value={selectedUserId || undefined}
              onValueChange={(value) => setSelectedUserId(value)}
              disabled={isLoading || usersLoading}
            >
              <SelectTrigger id="category-user">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  <SelectValue placeholder={usersLoading ? 'Loading users...' : 'Select a user'} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-muted-foreground px-2 py-2 text-sm">
                    No users available
                  </div>
                ) : (
                  users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <User className="size-3 text-muted-foreground" />
                        <span>{user.name || user.email}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Select a user to load their categories
            </p>
          </div>

          {/* Category Selector */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={data.category || undefined}
              onValueChange={(value) => onChange({ ...data, category: value || null })}
              disabled={isLoading || categoriesLoading || !selectedUserId}
            >
              <SelectTrigger id="category">
                <div className="flex items-center gap-2">
                  <Tag className="size-4 text-muted-foreground" />
                  <SelectValue placeholder={
                    !selectedUserId
                      ? 'Select a user first'
                      : categoriesLoading
                        ? 'Loading...'
                        : 'Select a category (optional)'
                  } />
                </div>
              </SelectTrigger>
              <SelectContent>
                {!selectedUserId ? (
                  <div className="text-muted-foreground px-2 py-2 text-sm">
                    Select a user first
                  </div>
                ) : categoriesLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : categoriesError ? (
                  <div className="text-destructive px-2 py-2 text-sm">
                    {categoriesError}
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-muted-foreground px-2 py-2 text-sm">
                    No categories available
                  </div>
                ) : (
                  categories.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      <div className="flex items-center gap-2">
                        <Tag className="size-3 text-muted-foreground" />
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {selectedUserId
                ? 'Associate agent with a category'
                : 'Select a user to see categories'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="is_global" className="font-medium">
              Global Agent
            </Label>
            <p className="text-muted-foreground text-sm">
              Global agents can be assigned to multiple users
            </p>
          </div>
          <Switch
            id="is_global"
            checked={data.is_global}
            onCheckedChange={(checked) => onChange({ ...data, is_global: checked })}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="is_active" className="font-medium">
              Active
            </Label>
            <p className="text-muted-foreground text-sm">
              Only active agents are available to users
            </p>
          </div>
          <Switch
            id="is_active"
            checked={data.is_active}
            onCheckedChange={(checked) => onChange({ ...data, is_active: checked })}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="button" onClick={onSubmit} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
