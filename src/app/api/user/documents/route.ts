/**
 * User Documents API
 * 
 * GET - Fetch documents from user's Supabase document_metadata table
 * POST - Save document metadata to user's Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { 
  getUserDocuments, 
  saveDocumentMetadata,
  checkDocumentMetadataTable,
  DOCUMENT_METADATA_TABLE_SQL
} from '@/lib/supabase/documentMetadata'

// GET /api/user/documents - Get documents from user's Supabase
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const sessionResult = await validateSession(token)

    if (!sessionResult.valid || !sessionResult.payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = sessionResult.payload.userId

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId') || undefined
    const subProjectId = searchParams.get('subProjectId') || undefined
    const category = searchParams.get('category') || undefined
    const subCategory = searchParams.get('subCategory') || undefined
    const source = searchParams.get('source') || undefined

    // First check if table exists
    const tableCheck = await checkDocumentMetadataTable(userId)
    
    if (!tableCheck.exists) {
      return NextResponse.json({
        error: 'document_metadata table not found',
        setupRequired: true,
        sql: DOCUMENT_METADATA_TABLE_SQL,
        documents: []
      }, { status: 404 })
    }

    // Fetch documents
    const result = await getUserDocuments(userId, {
      projectId,
      subProjectId,
      category,
      subCategory,
      source
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      documents: result.documents || [],
      count: result.documents?.length || 0
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// POST /api/user/documents - Save document metadata
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const sessionResult = await validateSession(token)

    if (!sessionResult.valid || !sessionResult.payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = sessionResult.payload.userId
    const body = await req.json()

    const { id, title, url, schema, category, sub_category, project_id, sub_project_id, source } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const result = await saveDocumentMetadata(userId, {
      id,
      title,
      url,
      schema,
      category,
      sub_category,
      project_id,
      sub_project_id,
      source: source || 'project'
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving document:', error)
    return NextResponse.json(
      { error: 'Failed to save document' },
      { status: 500 }
    )
  }
}
