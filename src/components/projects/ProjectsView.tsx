'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Project, ProjectFile } from '@/lib/types/projects'
import { FolderOpen, Plus, Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { ProjectTree } from './ProjectTree'
import { ProjectDetail } from './ProjectDetail'
import { FileEditor } from './FileEditor'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // New project dialog
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/user/projects')
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          setError('Supabase not configured. Please contact your administrator to set up your account.')
        } else {
          setError(data.error || 'Failed to load projects')
        }
        setProjects([])
        return
      }

      setProjects((data.projects || []) as Project[])
    } catch (err) {
      setError('Failed to connect to server. Please try again.')
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  async function createProject() {
    if (!newProjectName.trim()) {
      toast.error('Project name is required')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/user/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || undefined
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to create project')
        return
      }

      toast.success('Project created successfully')
      setShowNewProject(false)
      setNewProjectName('')
      setNewProjectDescription('')
      await loadProjects()
      // Select the new project
      if (data.project?.id) {
        setSelectedProjectId(data.project.id)
      }
    } catch (err) {
      toast.error('Failed to create project')
      console.error('Failed to create project:', err)
    } finally {
      setCreating(false)
    }
  }

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  return (
    <div className="flex w-full h-full">
      {/* Sidebar - Project Tree */}
      <div className="w-80 border-r bg-muted/30 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Projects
              {projects.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {projects.length}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1">
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={loadProjects}
                disabled={loading}
                className="h-8 w-8"
                title="Refresh"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
              <Button size="sm" className="h-8" onClick={() => setShowNewProject(true)}>
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-destructive font-medium">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadProjects}
                  className="mt-3"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {searchQuery ? 'No projects found' : 'No projects yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery 
                    ? 'Try a different search term' 
                    : 'Create a new project to get started'}
                </p>
                {!searchQuery && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowNewProject(true)}
                    className="mt-4"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create Project
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ProjectTree
              projects={filteredProjects}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onSelectFile={(file) => setSelectedFile(file)}
              selectedFile={selectedFile}
              onRefresh={loadProjects}
            />
          )}
        </div>

        {/* Footer Stats */}
        {!loading && !error && projects.length > 0 && (
          <div className="p-3 border-t bg-muted/50">
            <p className="text-xs text-muted-foreground text-center">
              {projects.length} project{projects.length !== 1 ? 's' : ''} • {projects.reduce((acc, p) => acc + (p.total_files_count || 0), 0)} files
            </p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-background min-w-0">
        {selectedFile ? (
          <FileEditor
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onSave={() => {
              loadProjects()
              toast.success('File saved successfully')
            }}
          />
        ) : selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            onBack={() => setSelectedProjectId(null)}
            onSelectFile={setSelectedFile}
            onRefresh={loadProjects}
          />
        ) : (
          <EmptyState onCreateProject={() => setShowNewProject(true)} />
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a new project to organize your files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                placeholder="e.g., Marketing Campaigns"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    createProject()
                  }
                }}
                disabled={creating}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Textarea
                id="project-description"
                placeholder="Brief description of the project..."
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                disabled={creating}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createProject} disabled={creating || !newProjectName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <FolderOpen className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Welcome to Projects</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Organize your files into projects and folders. Select a project from the sidebar or create a new one to get started.
        </p>
        <Button onClick={onCreateProject}>
          <Plus className="w-4 h-4 mr-2" />
          Create Your First Project
        </Button>
      </div>
    </div>
  )
}
