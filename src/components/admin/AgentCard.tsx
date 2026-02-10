'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { type Agent } from '@/lib/types/admin'
import { format } from 'date-fns'
import { Bot, Edit, Globe, Tag, Trash2, User } from 'lucide-react'

interface AgentCardProps {
  agent: Agent
  onToggleActive: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

export function AgentCard({
  agent,
  onToggleActive,
  onEdit,
  onDelete,
  isLoading = false
}: AgentCardProps) {
  const assignedCount = agent.assigned_to?.length || 0

  return (
    <Card className={agent.is_active ? '' : 'opacity-60'}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 rounded-lg p-2">
              <Bot className="text-primary h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {agent.is_global ? (
                  <Badge variant="secondary" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Global
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <User className="h-3 w-3" />
                    Private
                  </Badge>
                )}
                <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                  {agent.is_active ? 'Active' : 'Inactive'}
                </Badge>
                {agent.category && (
                  <Badge variant="outline" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {agent.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Switch
            checked={agent.is_active}
            onCheckedChange={() => onToggleActive(agent.id)}
            disabled={isLoading}
          />
        </div>
        {agent.description && (
          <CardDescription className="mt-2">{agent.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm">
            <div className="text-muted-foreground">
              {agent.is_global && (
                <span>
                  Assigned to {assignedCount} user{assignedCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {agent.webhook_url && (
              <div className="text-muted-foreground mt-1 truncate text-xs">{agent.webhook_url}</div>
            )}
          </div>

          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>Created {format(new Date(agent.created_at), 'MMM d, yyyy')}</span>
          </div>

          <div className="flex gap-2 border-t pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(agent.id)}
              disabled={isLoading}
            >
              <Edit className="mr-2 h-3 w-3" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive flex-1"
              onClick={() => onDelete(agent.id)}
              disabled={isLoading}
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
