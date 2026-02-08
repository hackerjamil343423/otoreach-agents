'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { Project, SubProject, ProjectFile } from '@/lib/types/projects'
import { 
  FolderOpen, 
  Plus, 
  FileText, 
  ChevronRight, 
  Clock,
  Files,
  Loader2,
  Trash2,
  Edit3,
  ArrowLeft,
  MoreHorizontal
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ProjectDetailProps {
  project: Project
  onBack?: () => void
  onSelectFile: (file: ProjectFile, projectId: string) => void
  onRefresh: () => void
}

export function ProjectDetail({ project, onBack, onSelectFile, onRefresh }: ProjectDetailProps) {
  const [view, setView] = useState<'subprojects' | 'files'>('subprojects')
  const [selectedSubProject, setSelectedSubProject] = useState<SubProject | null>(null)
  
  // New sub-project dialog
  const [showNewSubProject, setShowNewSubProject] = useState(false)
  const [newSubProjectName, setNewSubProjectName] = useState('')
  const [newSubProjectDesc, setNewSubProjectDesc] = useState('')
  const [creatingSubProject, setCreatingSubProject] = useState(false)

  // Load sub-projects
  const [subProjects, setSubProjects] = useState<SubProject[]>([])
  const [loadingSubProjects, setLoadingSubProjects] = useState(true)

  const loadSubProjects = useCallback(async () => {
    setLoadingSubProjects(true)
    try {
      const res = await fetch(`/api/user/projects/${project.id}/sub-projects`)
      if (res.ok) {
        const data = await res.json()
        setSubProjects(data.sub_projects || [])
      }
    } catch (err) {
      console.error('Failed to load sub-projects:', err)
    } finally {
      setLoadingSubProjects(false)
    }
  }, [project.id])

  useEffect(() => {
    loadSubProjects()
  }, [loadSubProjects])

  async function createSubProject() {
    if (!newSubProjectName.trim()) {
      toast.error('Folder name is required')
      return
    }

    setCreatingSubProject(true)
    try {
      const res = await fetch(`/api/user/projects/${project.id}/sub-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newSubProjectName.trim(),
          description: newSubProjectDesc.trim() || undefined
        })
      })

      if (res.ok) {
        toast.success('Folder created successfully')
        setShowNewSubProject(false)
        setNewSubProjectName('')
        setNewSubProjectDesc('')
        await loadSubProjects()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create folder')
      }
    } catch (err) {
      toast.error('Failed to create folder')
    } finally {
      setCreatingSubProject(false)
    }
  }

  if (selectedSubProject) {
    return (
      <SubProjectDetail
        project={project}
        subProject={selectedSubProject}
        onBack={() => setSelectedSubProject(null)}
        onSelectFile={(file) => onSelectFile(file, project.id)}
        onRefresh={() => {
          loadSubProjects()
          onRefresh()
        }}
      />
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-6 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: `${project.color}20`, color: project.color }}
            >
              {project.icon || '📁'}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FolderOpen className="w-4 h-4" />
                  {subProjects.length} folder{subProjects.length !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Files className="w-4 h-4" />
                  {project.total_files_count || 0} files
                </span>
                {project.updated_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <Button onClick={() => setShowNewSubProject(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loadingSubProjects ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading folders...</p>
          </div>
        ) : subProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 max-w-md mx-auto text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No folders yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create folders to organize your files within this project.
            </p>
            <Button onClick={() => setShowNewSubProject(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Folder
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subProjects.map((subProject) => (
              <SubProjectCard
                key={subProject.id}
                subProject={subProject}
                projectId={project.id}
                onClick={() => setSelectedSubProject(subProject)}
                onRefresh={loadSubProjects}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Sub-Project Dialog */}
      <Dialog open={showNewSubProject} onOpenChange={setShowNewSubProject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder in "{project.name}" to organize your files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name *</Label>
              <Input
                id="folder-name"
                placeholder="e.g., Documents, Reports"
                value={newSubProjectName}
                onChange={(e) => setNewSubProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createSubProject()
                }}
                disabled={creatingSubProject}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-desc">Description (optional)</Label>
              <Textarea
                id="folder-desc"
                placeholder="Brief description of this folder..."
                value={newSubProjectDesc}
                onChange={(e) => setNewSubProjectDesc(e.target.value)}
                disabled={creatingSubProject}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSubProject(false)} disabled={creatingSubProject}>
              Cancel
            </Button>
            <Button onClick={createSubProject} disabled={creatingSubProject || !newSubProjectName.trim()}>
              {creatingSubProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SubProjectCardProps {
  subProject: SubProject
  projectId: string
  onClick: () => void
  onRefresh: () => void
}

function SubProjectCard({ subProject, projectId, onClick, onRefresh }: SubProjectCardProps) {
  const [fileCount, setFileCount] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    // Load file count
    fetch(`/api/user/projects/sub-projects/${subProject.id}/files`)
      .then(res => res.json())
      .then(data => setFileCount(data.files?.length || 0))
      .catch(() => setFileCount(0))
  }, [subProject.id])

  async function deleteSubProject() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/user/projects/sub-projects/${subProject.id}`, { 
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('Folder deleted successfully')
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete folder')
      }
    } catch (err) {
      toast.error('Failed to delete folder')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow group relative"
        onClick={onClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FolderOpen className="w-5 h-5" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDeleteConfirm(true)
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardTitle className="text-base mt-2">{subProject.name}</CardTitle>
          {subProject.description && (
            <CardDescription className="line-clamp-2">{subProject.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center text-sm text-muted-foreground">
            <Files className="w-4 h-4 mr-1" />
            {fileCount} file{fileCount !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{subProject.name}"? This will also delete all files within it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteSubProject} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface SubProjectDetailProps {
  project: Project
  subProject: SubProject
  onBack: () => void
  onSelectFile: (file: ProjectFile) => void
  onRefresh: () => void
}

function SubProjectDetail({ project, subProject, onBack, onSelectFile, onRefresh }: SubProjectDetailProps) {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  
  // New file dialog
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileDesc, setNewFileDesc] = useState('')
  const [newFileContent, setNewFileContent] = useState('')
  const [creating, setCreating] = useState(false)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/projects/sub-projects/${subProject.id}/files`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
      }
    } catch (err) {
      console.error('Failed to load files:', err)
    } finally {
      setLoading(false)
    }
  }, [subProject.id])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  async function createFile() {
    if (!newFileName.trim()) {
      toast.error('File name is required')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/user/projects/sub-projects/${subProject.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFileName.trim(),
          content: newFileContent,
          fileType: newFileName.endsWith('.md') ? 'markdown' : 'text'
        })
      })

      if (res.ok) {
        toast.success('File created successfully')
        setShowNewFile(false)
        setNewFileName('')
        setNewFileDesc('')
        setNewFileContent('')
        await loadFiles()
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create file')
      }
    } catch (err) {
      toast.error('Failed to create file')
    } finally {
      setCreating(false)
    }
  }

  async function deleteFile(fileId: string) {
    try {
      const res = await fetch(`/api/user/projects/sub-projects/files/${fileId}`, { 
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('File deleted successfully')
        loadFiles()
        onRefresh()
      } else {
        toast.error('Failed to delete file')
      }
    } catch (err) {
      toast.error('Failed to delete file')
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Breadcrumb Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Button variant="ghost" size="sm" className="h-auto py-1 px-2" onClick={onBack}>
            {project.name}
          </Button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{subProject.name}</span>
        </div>
        
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{subProject.name}</h2>
              {subProject.description && (
                <p className="text-sm text-muted-foreground">{subProject.description}</p>
              )}
            </div>
          </div>
          <Button onClick={() => setShowNewFile(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New File
          </Button>
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No files yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first file in this folder.
            </p>
            <Button onClick={() => setShowNewFile(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First File
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onClick={() => onSelectFile(file)}
                onDelete={() => deleteFile(file.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={showNewFile} onOpenChange={setShowNewFile}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>
              Create a file in "{subProject.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file-name">File Name *</Label>
              <Input
                id="file-name"
                placeholder="e.g., document.txt, notes.md"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                disabled={creating}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Use .md extension for markdown files
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-desc">Description (optional)</Label>
              <Input
                id="file-desc"
                placeholder="Brief description of this file..."
                value={newFileDesc}
                onChange={(e) => setNewFileDesc(e.target.value)}
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-content">Content</Label>
              <Textarea
                id="file-content"
                placeholder="Enter file content here..."
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                disabled={creating}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFile(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createFile} disabled={creating || !newFileName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface FileCardProps {
  file: ProjectFile
  onClick: () => void
  onDelete: () => void
}

function FileCard({ file, onClick, onDelete }: FileCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  return (
    <>
      <div 
        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer group transition-colors"
        onClick={onClick}
      >
        <div className="w-9 h-9 rounded bg-blue-50 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {file.file_type} • {new Date(file.updated_at || '').toLocaleDateString()}
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            setShowDeleteConfirm(true)
          }}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{file.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { onDelete(); setShowDeleteConfirm(false); }}>
              Delete File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
