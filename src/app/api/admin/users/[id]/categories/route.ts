/**
 * Admin API: User Categories
 *
 * GET - Get categories for a specific user (from their Supabase)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { validateAdminSession } from '@/lib/auth/admin-session'

async function validateAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_session')?.value
  if (!token) return false

  const sessionResult = await validateAdminSession(token)
  return sessionResult.valid && sessionResult.payload?.type === 'admin'
}

// GET /api/admin/users/[id]/categories - Get categories for a specific user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await validateAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params

    try {
      const supabase = await createSupabaseAdminClient(userId)

      // Fetch all documents with category info
      const { data, error } = await supabase
        .from('document_metadata')
        .select('category, sub_category')
        .not('category', 'is', null)

      if (error) {
        // Check if table doesn't exist
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          return NextResponse.json(
            {
              error: 'document_metadata table not found',
              categories: []
            },
            { status: 200 }
          )
        }
        return NextResponse.json({
          error: error.message,
          categories: []
        }, { status: 200 })
      }

      // Group by category and sub-categories
      const categoryMap = new Map<string, Set<string>>()

      data?.forEach((doc: { category: string; sub_category: string | null }) => {
        const category = doc.category || 'Uncategorized'
        const subCategory = doc.sub_category

        if (!categoryMap.has(category)) {
          categoryMap.set(category, new Set())
        }

        if (subCategory) {
          categoryMap.get(category)?.add(subCategory)
        }
      })

      // Convert to array format
      const categories = Array.from(categoryMap.entries()).map(([name, subCats]) => ({
        name,
        subCategories: Array.from(subCats).sort()
      }))

      // Sort categories alphabetically
      categories.sort((a, b) => a.name.localeCompare(b.name))

      return NextResponse.json({ categories })
    } catch (error) {
      console.error('Failed to fetch categories for user:', userId, error)
      return NextResponse.json(
        {
          error: 'Failed to fetch categories from Supabase',
          categories: []
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        categories: []
      },
      { status: 500 }
    )
  }
}
