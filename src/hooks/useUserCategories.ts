'use client'

import { useCallback, useEffect, useState } from 'react'

export interface Category {
  name: string
  subCategories: string[]
}

interface UseUserCategoriesOptions {
  autoFetch?: boolean
}

export function useUserCategories(options: UseUserCategoriesOptions = {}) {
  const { autoFetch = true } = options
  
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSetupRequired(false)

    try {
      const res = await fetch('/api/user/documents/categories')
      
      if (!res.ok) {
        const data = await res.json()
        if (data.error?.includes('not found') || data.error?.includes('table')) {
          setSetupRequired(true)
          setCategories([])
          return
        }
        throw new Error(data.error || 'Failed to fetch categories')
      }

      const data = await res.json()
      setCategories(data.categories || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories')
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoFetch) {
      void fetchCategories()
    }
  }, [autoFetch, fetchCategories])

  return {
    categories,
    loading,
    error,
    setupRequired,
    refetch: fetchCategories
  }
}
