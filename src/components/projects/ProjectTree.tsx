'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, File, Folder, Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Project, ProjectFile, SubProject } from '@/lib/types/projects'
import { cn } from '@/lib/utils'

interface ProjectTreeProps {
  projects: Project[]
  onSelectFile: (file: ProjectFile) => void
  selectedFile: ProjectFile | null
  onRefresh: () => void
}

export function ProjectTree({ projects, onSelectFile, selectedFile, onRefresh }: ProjectTreeProps) {
  return (
    <div className="space-y-1">
      {projects.map((project) => (
        <ProjectItem
          key={project.id}
          project={project}
          onSelectFile={onSelectFile}
          selectedFile={selectedFile}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
}

interface ProjectItemProps {
  project: Project
  onSelectFile: (file: ProjectFile) => void
  selectedFile: ProjectFile | null
  onRefresh: () => void
}

function ProjectItem({ project, onSelectFile, selectedFile, onRefresh }: ProjectItemProps) {
  const [expanded, setExpanded] = useState(true)
  const [showNewSubProject, setShowNewSubProject] = useState(false)
  const [newSubProjectName, setNewSubProjectName] = useState('')
  const [creating, setCreating] = useState(false)

  // Load sub-projects from the project data
  const subProjects = project.sub_projects || []

  async function createSubProject() {
    if (!newSubProjectName.trim()) return

    setCreating(true)

    try {
      const res = await fetch(`/api/user/projects/${project.id}/sub-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubProjectName.trim() })
      })

      if (res.ok) {
        setShowNewSubProject(false)
        setNewSubProjectName('')
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to create sub-project:', err)
    } finally {
      setCreating(false)
    }
  }

  async function deleteProject() {
    if (!confirm(`Delete project "${project.name}" and all its contents?`)) return

    try {
      const res = await fetch(`/api/user/projects/${project.id}`, { method: 'DELETE' })
      if (res.ok) {
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md text-left flex-1"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Folder className="w-4 h-4" style={{ color: project.color }} />
          <span className="text-sm font-medium truncate">{project.name}</span>
        </button>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <Dialog open={showNewSubProject} onOpenChange={setShowNewSubProject}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                <Plus className="w-3 h-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subproject-name">Folder Name</Label>
                  <Input
                    id="subproject-name"
                    placeholder="My Folder"
                    value={newSubProjectName}
                    onChange={(e) => setNewSubProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createSubProject()}
                    disabled={creating}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewSubProject(false)} disabled={creating}>
                    Cancel
                  </Button>
                  <Button onClick={createSubProject} disabled={creating || !newSubProjectName.trim()}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={deleteProject}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {expanded && subProjects.length > 0 && (
        <div className="ml-6 mt-1 space-y-1">
          {subProjects.map((subProject) => (
            <SubProjectItem
              key={subProject.id}
              subProject={subProject}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SubProjectItemProps {
  subProject: SubProject
  onSelectFile: (file: ProjectFile) => void
  selectedFile: ProjectFile | null
  onRefresh: () => void
}

function SubProjectItem({ subProject, onSelectFile, selectedFile, onRefresh }: SubProjectItemProps) {
  const [expanded, setExpanded] = useState(true)
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const files = subProject.files?.filter((f): f is ProjectFile => Boolean(f && f.id)) || []

  async function createFile() {
    if (!newFileName.trim()) return

    setCreating(true)

    try {
      const res = await fetch(`/api/user/projects/sub-projects/${subProject.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFileName.trim(),
          content: '',
          fileType: 'text'
        })
      })

      if (res.ok) {
        setShowNewFile(false)
        setNewFileName('')
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to create file:', err)
    } finally {
      setCreating(false)
    }
  }

  async function deleteFile(fileId: string) {
    if (!confirm('Delete this file?')) return

    setDeleting(fileId)

    try {
      await fetch(`/api/user/projects/sub-projects/files/${fileId}`, { method: 'DELETE' })
      onRefresh()
    } catch (err) {
      console.error('Failed to delete file:', err)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded-md text-left flex-1"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
          <Folder className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs">{subProject.name}</span>
        </button>

        <Dialog open={showNewFile} onOpenChange={setShowNewFile}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
              <Plus className="w-3 h-3" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New File</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file-name">File Name</Label>
                <Input
                  id="file-name"
                  placeholder="my-file.txt"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  disabled={creating}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewFile(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button onClick={createFile} disabled={creating || !newFileName.trim()}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {expanded && files.length > 0 && (
        <div className="ml-4 mt-1 space-y-0.5">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-1 group/file">
              <button
                onClick={() => onSelectFile({ ...file, sub_project_id: subProject.id })}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 hover:bg-accent rounded-md text-left flex-1",
                  selectedFile?.id === file.id && "bg-accent"
                )}
              >
                <File className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs truncate">{file.name}</span>
              </button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 text-destructive opacity-0 group-hover/file:opacity-100"
                onClick={() => deleteFile(file.id)}
                disabled={deleting === file.id}
              >
                {deleting === file.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
