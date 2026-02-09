'use client'

import { useCallback, useEffect, useState } from 'react'

export interface Category {
  name: string
  subCategories: string[]
}

interface UseAdminUserCategoriesOptions {
  autoFetch?: boolean
}

export function useAdminUserCategories(
  userId: string | null,
  options: UseAdminUserCategoriesOptions = {}
) {
  const { autoFetch = false } = options

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    if (!userId) {
      setCategories([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/categories`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch categories')
      }

      const data = await res.json()

      if (data.error) {
        // If there's an error but categories array is also returned, use that
        if (data.categories) {
          setCategories(data.categories)
          setError(data.error)
        } else {
          setError(data.error)
          setCategories([])
        }
      } else {
        setCategories(data.categories || [])
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories')
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (autoFetch && userId) {
      void fetchCategories()
    } else if (!userId) {
      // Clear categories when no user is selected
      setCategories([])
      setError(null)
    }
  }, [userId, autoFetch, fetchCategories])

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories
  }
}
