'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ProjectFile } from '@/lib/types/projects'
import { X, Save, Loader2, FileText } from 'lucide-react'

interface FileEditorProps {
  file: ProjectFile
  onClose: () => void
  onSave: () => void
}

export function FileEditor({ file, onClose, onSave }: FileEditorProps) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const loadFileContent = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/user/projects/sub-projects/files/${file.id}`)
      if (res.ok) {
        const data = await res.json()
        setContent(data.content)
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
        body: JSON.stringify({ content })
      })

      if (res.ok) {
        setHasChanges(false)
        onSave()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save file')
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error('Failed to save file:', err)
    } finally {
      setSaving(false)
    }
  }

  function handleContentChange(value: string) {
    setContent(value)
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <FileText className="text-primary h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">{file.name}</h3>
            <p className="text-sm text-muted-foreground">
              {file.file_type === 'markdown' ? 'Markdown' : 'Plain Text'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
          )}
          <Button size="sm" onClick={saveFile} disabled={saving || !hasChanges || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClose} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="h-full font-mono text-sm resize-none focus:outline-none"
            placeholder="Start typing..."
            disabled={saving}
          />
        )}
      </div>
    </div>
  )
}
