'use client'

import { useCallback, useEffect, useState } from 'react'

export interface UserDocument {
  id: string
  title: string | null
  url: string | null
  created_at: string
  schema: string | null
  category?: string | null
  sub_category?: string | null
  project_id?: string | null
  sub_project_id?: string | null
  source?: string | null
}

export interface UseUserDocumentsOptions {
  projectId?: string
  subProjectId?: string
  category?: string
  subCategory?: string
  source?: string
  autoFetch?: boolean
}

export function useUserDocuments(options: UseUserDocumentsOptions = {}) {
  const { projectId, subProjectId, category, subCategory, source, autoFetch = true } = options
  const [documents, setDocuments] = useState<UserDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [setupSql, setSetupSql] = useState<string>('')

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSetupRequired(false)

    try {
      const params = new URLSearchParams()
      if (projectId) params.append('projectId', projectId)
      if (subProjectId) params.append('subProjectId', subProjectId)
      if (category) params.append('category', category)
      if (subCategory) params.append('subCategory', subCategory)
      if (source) params.append('source', source)

      const res = await fetch(`/api/user/documents?${params}`, {
        credentials: 'include'
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 404 && data.setupRequired) {
          setSetupRequired(true)
          setSetupSql(data.sql || '')
          setDocuments([])
          return
        }
        throw new Error(data.error || 'Failed to fetch documents')
      }

      setDocuments(data.documents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [projectId, subProjectId, category, subCategory, source])

  useEffect(() => {
    if (autoFetch) {
      void fetchDocuments()
    }
  }, [autoFetch, fetchDocuments, projectId, subProjectId, category, subCategory, source])

  const refresh = useCallback(() => {
    return fetchDocuments()
  }, [fetchDocuments])

  return {
    documents,
    loading,
    error,
    setupRequired,
    setupSql,
    refresh
  }
}

/**
 * Convert user documents to chat file format
 */
export function convertDocumentsToChatFiles(
  documents: UserDocument[]
): Array<{
  name: string
  content: string
  mimeType: string
  size?: string
  type?: string
  images?: Array<{
    pageNumber: number
    name: string
    width: number
    height: number
    dataUrl: string
  }>
}> {
  return documents.map((doc) => {
    // Determine file type from title or schema
    const fileName = doc.title || 'unnamed'
    const extension = fileName.split('.').pop()?.toLowerCase() || ''
    
    const typeMap: Record<string, string> = {
      'json': 'json',
      'pdf': 'pdf',
      'csv': 'csv',
      'txt': 'txt',
      'xlsx': 'xlsx',
      'xls': 'xlsx',
      'sql': 'sql',
      'md': 'markdown',
      'doc': 'doc',
      'docx': 'doc'
    }

    const mimeTypeMap: Record<string, string> = {
      'json': 'application/json',
      'pdf': 'application/pdf',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'sql': 'text/plain',
      'md': 'text/markdown',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    return {
      name: fileName,
      content: `File stored at: ${doc.url || 'unknown'}`,
      mimeType: mimeTypeMap[extension] || 'application/octet-stream',
      size: 'Unknown',
      type: typeMap[extension] || 'file'
    }
  })
}
