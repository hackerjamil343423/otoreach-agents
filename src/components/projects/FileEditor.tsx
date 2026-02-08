'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProjectFile } from '@/lib/types/projects'
import { X, Save, Loader2, FileText, ChevronLeft, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface FileEditorProps {
  file: ProjectFile
  onClose: () => void
  onSave: () => void
}

export function FileEditor({ file, onClose, onSave }: FileEditorProps) {
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const loadFileContent = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/user/projects/sub-projects/files/${file.id}`)
      if (res.ok) {
        const data = await res.json()
        setContent(data.content || '')
        setDescription(data.description || '')
        setLastSaved(data.updated_at ? new Date(data.updated_at) : null)
      } else {
        setError('Failed to load file')
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error('Failed to load file:', err)
    } finally {
      setLoading(false)
    }
  }, [file.id])

  useEffect(() => {
    void loadFileContent()
  }, [loadFileContent])

  async function saveFile() {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/user/projects/sub-projects/files/${file.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, description })
      })

      if (res.ok) {
        setHasChanges(false)
        setLastSaved(new Date())
        onSave()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save file')
        toast.error(data.error || 'Failed to save file')
      }
    } catch (err) {
      setError('Failed to connect to server')
      toast.error('Failed to save file')
      console.error('Failed to save file:', err)
    } finally {
      setSaving(false)
    }
  }

  function handleContentChange(value: string) {
    setContent(value)
    setHasChanges(true)
  }

  function handleDescriptionChange(value: string) {
    setDescription(value)
    setHasChanges(true)
  }

  function handleClose() {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  // Auto-save indicator
  const getSaveStatus = () => {
    if (saving) return 'Saving...'
    if (hasChanges) return 'Unsaved changes'
    if (lastSaved) return `Saved ${lastSaved.toLocaleTimeString()}`
    return ''
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={handleClose} className="shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="bg-primary/10 rounded-lg p-2 shrink-0">
            <FileText className="text-primary h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{file.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getSaveStatus()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            size="sm" 
            onClick={saveFile} 
            disabled={saving || (!hasChanges && !loading) || loading}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-4 bg-destructive/10 text-destructive rounded-md p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-auto h-auto py-1 px-2"
            onClick={loadFileContent}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="file-description" className="text-sm font-medium">
                Description (optional)
              </Label>
              <Input
                id="file-description"
                placeholder="Add a description for this file..."
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={saving}
                className="bg-muted/30"
              />
            </div>

            {/* Content Field */}
            <div className="space-y-2 flex-1">
              <Label htmlFor="file-content" className="text-sm font-medium">
                Content
              </Label>
              <Textarea
                id="file-content"
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="min-h-[calc(100vh-280px)] font-mono text-sm resize-none focus-visible:ring-1"
                placeholder="Enter file content here..."
                disabled={saving}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
