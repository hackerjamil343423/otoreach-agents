'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { type AgentFormData } from '@/lib/types/admin'
import { Loader2 } from 'lucide-react'

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
