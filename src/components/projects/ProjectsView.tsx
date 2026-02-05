'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { Project, ProjectFile } from '@/lib/types/projects'
import { FolderOpen, Plus, Search, Loader2, AlertCircle } from 'lucide-react'
import { ProjectTree } from './ProjectTree'
import { FileEditor } from './FileEditor'

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
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
  }

  async function createProject() {
    if (!newProjectName.trim()) return

    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/user/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create project')
        return
      }

      setShowNewProject(false)
      setNewProjectName('')
      loadProjects()
    } catch (err) {
      setError('Failed to create project. Please try again.')
      console.error('Failed to create project:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex w-full h-full">
      {/* Sidebar - Project Tree */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Projects
            </h2>
            <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      placeholder="My Project"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createProject()}
                      disabled={creating}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowNewProject(false)} disabled={creating}>
                      Cancel
                    </Button>
                    <Button onClick={createProject} disabled={creating || !newProjectName.trim()}>
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No projects yet</p>
              <p className="text-xs text-muted-foreground">Create a new project to get started</p>
            </div>
          ) : (
            <ProjectTree
              projects={projects}
              onSelectFile={setSelectedFile}
              selectedFile={selectedFile}
              onRefresh={loadProjects}
            />
          )}
        </div>
      </div>

      {/* Main Content - File Editor */}
      <div className="flex-1">
        {selectedFile ? (
          <FileEditor
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onSave={loadProjects}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Select a file to edit or create a new project</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
