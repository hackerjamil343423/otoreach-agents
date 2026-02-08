'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, Plus, Trash2, Loader2, MoreHorizontal, FolderOpen, FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Project, ProjectFile, SubProject } from '@/lib/types/projects'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ProjectTreeProps {
  projects: Project[]
  selectedProjectId: string | null
  onSelectProject: (projectId: string | null) => void
  onSelectFile: (file: ProjectFile, projectId: string) => void
  selectedFile: ProjectFile | null
  onRefresh: () => void
}

export function ProjectTree({ 
  projects, 
  selectedProjectId,
  onSelectProject,
  onSelectFile, 
  selectedFile,
  onRefresh 
}: ProjectTreeProps) {
  return (
    <div className="space-y-1">
      {projects.map((project) => (
        <ProjectItem
          key={project.id}
          project={project}
          isSelected={selectedProjectId === project.id}
          onSelectProject={onSelectProject}
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
  isSelected: boolean
  onSelectProject: (projectId: string | null) => void
  onSelectFile: (file: ProjectFile, projectId: string) => void
  selectedFile: ProjectFile | null
  onRefresh: () => void
}

function ProjectItem({ project, isSelected, onSelectProject, onSelectFile, selectedFile, onRefresh }: ProjectItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [subProjects, setSubProjects] = useState<SubProject[]>([])
  const [loadingSubProjects, setLoadingSubProjects] = useState(false)
  
  // Dialog states
  const [showNewSubProject, setShowNewSubProject] = useState(false)
  const [newSubProjectName, setNewSubProjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load sub-projects when expanded
  useEffect(() => {
    if (expanded && subProjects.length === 0 && project.sub_projects_count && project.sub_projects_count > 0) {
      loadSubProjects()
    }
  }, [expanded, project.id])

  const loadSubProjects = useCallback(async () => {
    setLoadingSubProjects(true)
    try {
      const res = await fetch(`/api/user/projects/${project.id}/sub-projects`)
      if (res.ok) {
        const data = await res.json()
        setSubProjects(data.sub_projects || [])
      } else {
        toast.error('Failed to load folders')
      }
    } catch (err) {
      console.error('Failed to load sub-projects:', err)
      toast.error('Failed to load folders')
    } finally {
      setLoadingSubProjects(false)
    }
  }, [project.id])

  async function createSubProject() {
    if (!newSubProjectName.trim()) {
      toast.error('Folder name is required')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/user/projects/${project.id}/sub-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubProjectName.trim() })
      })

      if (res.ok) {
        toast.success('Folder created successfully')
        setShowNewSubProject(false)
        setNewSubProjectName('')
        await loadSubProjects()
        onRefresh()
        if (!expanded) setExpanded(true)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create folder')
      }
    } catch (err) {
      console.error('Failed to create sub-project:', err)
      toast.error('Failed to create folder')
    } finally {
      setCreating(false)
    }
  }

  async function deleteProject() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/user/projects/${project.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Project deleted successfully')
        setShowDeleteConfirm(false)
        onRefresh()
        if (isSelected) onSelectProject(null)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete project')
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
      toast.error('Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggle = () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)
    if (newExpanded) {
      onSelectProject(project.id)
    }
  }

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center gap-1 group rounded-lg transition-colors",
          isSelected && "bg-accent"
        )}
      >
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 px-2 py-2 hover:bg-accent/50 rounded-lg text-left flex-1 min-w-0"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-lg shrink-0">{project.icon || '📁'}</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">{project.name}</span>
          </div>
          {(project.sub_projects_count || 0) > 0 && (
            <span className="text-xs text-muted-foreground shrink-0 ml-auto">
              {project.sub_projects_count} folder{project.sub_projects_count !== 1 ? 's' : ''}
            </span>
          )}
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation()
              setShowNewSubProject(true)
            }}
            title="Add folder"
          >
            <Plus className="w-4 h-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sub-projects */}
      {expanded && (
        <div className="ml-6 mt-1 space-y-1">
          {loadingSubProjects ? (
            <div className="flex items-center gap-2 py-2 px-2 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Loading folders...</span>
            </div>
          ) : subProjects.length === 0 ? (
            <div className="py-2 px-2 text-xs text-muted-foreground">
              No folders yet
              <button 
                onClick={() => setShowNewSubProject(true)}
                className="ml-2 text-primary hover:underline"
              >
                Create one
              </button>
            </div>
          ) : (
            subProjects.map((subProject) => (
              <SubProjectItem
                key={subProject.id}
                subProject={subProject}
                projectId={project.id}
                onSelectFile={onSelectFile}
                selectedFile={selectedFile}
                onRefresh={() => {
                  loadSubProjects()
                  onRefresh()
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Create Sub-Project Dialog */}
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
                placeholder="e.g., Documents"
                value={newSubProjectName}
                onChange={(e) => setNewSubProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createSubProject()
                }}
                disabled={creating}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSubProject(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createSubProject} disabled={creating || !newSubProjectName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{project.name}"? This will also delete all folders and files within it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteProject} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SubProjectItemProps {
  subProject: SubProject
  projectId: string
  onSelectFile: (file: ProjectFile, projectId: string) => void
  selectedFile: ProjectFile | null
  onRefresh: () => void
}

function SubProjectItem({ subProject, projectId, onSelectFile, selectedFile, onRefresh }: SubProjectItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  
  // Dialog states
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load files when expanded
  useEffect(() => {
    if (expanded && files.length === 0) {
      loadFiles()
    }
  }, [expanded, subProject.id])

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true)
    try {
      const res = await fetch(`/api/user/projects/sub-projects/${subProject.id}/files`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
      } else {
        toast.error('Failed to load files')
      }
    } catch (err) {
      console.error('Failed to load files:', err)
      toast.error('Failed to load files')
    } finally {
      setLoadingFiles(false)
    }
  }, [subProject.id])

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
          content: '',
          fileType: newFileName.endsWith('.md') ? 'markdown' : 'text'
        })
      })

      if (res.ok) {
        toast.success('File created successfully')
        setShowNewFile(false)
        setNewFileName('')
        await loadFiles()
        onRefresh()
        if (!expanded) setExpanded(true)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create file')
      }
    } catch (err) {
      console.error('Failed to create file:', err)
      toast.error('Failed to create file')
    } finally {
      setCreating(false)
    }
  }

  async function deleteSubProject() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/user/projects/sub-projects/${subProject.id}`, { 
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('Folder deleted successfully')
        setShowDeleteConfirm(false)
        onRefresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete folder')
      }
    } catch (err) {
      console.error('Failed to delete sub-project:', err)
      toast.error('Failed to delete folder')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md text-left flex-1 min-w-0"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm truncate">{subProject.name}</span>
          {files.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0 rounded-full shrink-0 ml-auto">
              {files.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              setShowNewFile(true)
            }}
            title="Add file"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Files */}
      {expanded && (
        <div className="ml-5 mt-0.5 space-y-0.5">
          {loadingFiles ? (
            <div className="flex items-center gap-2 py-2 px-2 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Loading files...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="py-2 px-2 text-xs text-muted-foreground">
              No files yet
              <button 
                onClick={() => setShowNewFile(true)}
                className="ml-2 text-primary hover:underline"
              >
                Create one
              </button>
            </div>
          ) : (
            files.map((file) => (
              <div key={file.id} className="flex items-center gap-1 group/file">
                <button
                  onClick={() => onSelectFile({ ...file, sub_project_id: subProject.id }, projectId)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md text-left flex-1 min-w-0",
                    selectedFile?.id === file.id && "bg-accent"
                  )}
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate">{file.name}</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create File Dialog */}
      <Dialog open={showNewFile} onOpenChange={setShowNewFile}>
        <DialogContent className="sm:max-w-md">
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
                placeholder="e.g., document.txt"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createFile()
                }}
                disabled={creating}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Use .md extension for markdown files
              </p>
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

      {/* Delete Sub-Project Confirmation */}
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
    </div>
  )
}
