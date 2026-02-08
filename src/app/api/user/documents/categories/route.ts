import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

export const runtime = 'edge'

// GET /api/user/documents/categories - Get distinct categories and sub-categories
export async function GET(req: NextRequest) {
  try {
    // Validate user session
    const token = req.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionResult = await validateSession(token)
    if (!sessionResult.valid || !sessionResult.payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = sessionResult.payload.userId

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
            { error: 'document_metadata table not found' },
            { status: 404 }
          )
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
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
      console.error('Failed to fetch categories:', error)
      return NextResponse.json(
        { error: 'Failed to fetch categories from Supabase' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
