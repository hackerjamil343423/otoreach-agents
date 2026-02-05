'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type UserSelectOption } from '@/lib/types/admin'
import { Check, Users, X } from 'lucide-react'

interface UserMultiSelectProps {
  users: UserSelectOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  maxDisplay?: number
}

export function UserMultiSelect({
  users,
  selectedIds,
  onChange,
  disabled = false,
  maxDisplay = 3
}: UserMultiSelectProps) {
  const [search, setSearch] = useState('')

  const filteredUsers = users.filter(
    (user) =>
      user.label.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  )

  const selectedUsers = users.filter((u) => selectedIds.includes(u.value))
  const displayUsers = selectedUsers.slice(0, maxDisplay)
  const remainingCount = selectedUsers.length - maxDisplay

  const toggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId))
    } else {
      onChange([...selectedIds, userId])
    }
  }

  const selectAll = () => {
    onChange(filteredUsers.map((u) => u.value))
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className="space-y-2">
      <Label>Assign to Users</Label>

      {/* Selected users display */}
      <div className="bg-background flex flex-wrap gap-2 rounded-lg border p-3">
        {selectedUsers.length === 0 ? (
          <span className="text-muted-foreground text-sm">No users assigned</span>
        ) : (
          <>
            {displayUsers.map((user) => (
              <Badge key={user.value} variant="secondary" className="gap-1 pl-2">
                <span>{user.label}</span>
                <button
                  type="button"
                  onClick={() => toggleUser(user.value)}
                  disabled={disabled}
                  className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {remainingCount > 0 && <Badge variant="outline">+{remainingCount} more</Badge>}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={disabled || selectedUsers.length === 0}
              className="h-6 text-xs"
            >
              Clear all
            </Button>
          </>
        )}
      </div>

      {/* User selection dropdown */}
      <div className="rounded-lg border">
        <div className="bg-muted/30 border-b p-2">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
            className="h-8"
          />
        </div>

        <div className="max-h-48 space-y-1 overflow-y-auto p-2">
          {filteredUsers.length === 0 ? (
            <div className="text-muted-foreground py-2 text-center text-sm">No users found</div>
          ) : (
            <>
              <div className="text-muted-foreground flex items-center justify-between px-2 py-1 text-xs">
                <span>{filteredUsers.length} users</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    disabled={disabled}
                    className="h-6 text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    disabled={disabled}
                    className="h-6 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {filteredUsers.map((user) => {
                const isSelected = selectedIds.includes(user.value)
                return (
                  <button
                    key={user.value}
                    type="button"
                    onClick={() => toggleUser(user.value)}
                    disabled={disabled}
                    className={`flex w-full items-center gap-2 rounded p-2 text-left text-sm transition-colors ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{user.label}</div>
                      <div className="text-xs opacity-70">{user.email}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Users className="h-3 w-3" />
        <span>
          {selectedIds.length} user{selectedIds.length !== 1 ? 's' : ''} selected
        </span>
      </div>
    </div>
  )
}
