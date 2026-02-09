'use client'

import { useCallback, useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Project } from '@/lib/types/projects'
import { FolderOpen, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProjectSelectorProps {
  chatId: string
  selectedProject: Project | null
  onSelect: (project: Project | null) => void
}

export function ProjectSelector({ chatId, selectedProject, onSelect }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/user/projects')
      if (res.ok) {
        const data = await res.json() as { projects?: Project[] }
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLinkedProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/chats/${chatId}/project`)
      if (res.ok) {
        const data = await res.json() as { project?: Project | null }
        if (data.project) {
          onSelect(data.project)
        }
      }
    } catch (error) {
      console.error('Failed to load linked project:', error)
    }
  }, [chatId, onSelect])

  useEffect(() => {
    void loadProjects()
    void loadLinkedProject()
  }, [loadProjects, loadLinkedProject])

  async function linkProject(projectId: string) {
    if (!projectId) return

    setLinking(true)

    try {
      const res = await fetch(`/api/user/chats/${chatId}/project`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      })

      if (res.ok) {
        const data = await res.json() as { project: Project }
        onSelect(data.project)
      }
    } catch (error) {
      console.error('Failed to link project:', error)
    } finally {
      setLinking(false)
    }
  }

  async function unlinkProject() {
    setLinking(true)

    try {
      const res = await fetch(`/api/user/chats/${chatId}/project`, {
        method: 'DELETE'
      })

      if (res.ok) {
        onSelect(null)
      }
    } catch (error) {
      console.error('Failed to unlink project:', error)
    } finally {
      setLinking(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading projects...</div>
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        {selectedProject ? (
          <div className="flex items-center gap-2 bg-accent rounded-md px-3 py-1.5">
            <span className="text-lg shrink-0">{selectedProject.icon || '📁'}</span>
            <span className="text-sm">{selectedProject.name}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0"
              onClick={unlinkProject}
              disabled={linking}
              title="Unlink project"
            >
              <Unlink className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Select value="" onValueChange={linkProject} disabled={linking}>
            <SelectTrigger className="w-64 h-9">
              <SelectValue placeholder="Link to project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  No projects available
                </div>
              ) : (
                projects.map((project) => (
                  <SelectItem key={project.id} value={project.id} textValue={project.name}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg shrink-0">{project.icon || '📁'}</span>
                      <span>{project.name}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
