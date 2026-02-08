'use client'

import { useCallback, useEffect, useState } from 'react'

export interface Project {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  sub_projects_count?: number
  total_files_count?: number
}

export interface SubProject {
  id: string
  project_id: string
  name: string
  description: string | null
  icon: string
}

export function useUserProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [subProjects, setSubProjects] = useState<Record<string, SubProject[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/user/projects', {
        credentials: 'include'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch projects')
      }

      const data = await res.json()
      setProjects(data.projects || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSubProjects = useCallback(async (projectId: string) => {
    if (!projectId) return

    try {
      const res = await fetch(`/api/user/projects/${projectId}/sub-projects`, {
        credentials: 'include'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch sub-projects')
      }

      const data = await res.json()
      setSubProjects(prev => ({
        ...prev,
        [projectId]: data.subProjects || []
      }))
    } catch (err) {
      console.error('Failed to fetch sub-projects:', err)
    }
  }, [])

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  return {
    projects,
    subProjects,
    loading,
    error,
    refresh: fetchProjects,
    fetchSubProjects
  }
}
