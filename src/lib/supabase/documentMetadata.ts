/**
 * User Supabase Document Metadata Operations
 * 
 * These functions interact with the user's own Supabase document_metadata table.
 * The user creates this table themselves in their Supabase project.
 * 
 * Expected table structure:
 * CREATE TABLE document_metadata (
 *     id TEXT PRIMARY KEY,
 *     title TEXT,
 *     url TEXT,
 *     created_at TIMESTAMP DEFAULT NOW(),
 *     schema TEXT,
 *     project_id TEXT,        -- Optional: links to Neon project
 *     sub_project_id TEXT,    -- Optional: links to Neon sub-project
 *     source TEXT             -- 'upload', 'project', 'chat', etc.
 * );
 */

import { createSupabaseAdminClient } from './client'

export interface DocumentMetadata {
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

export interface DocumentMetadataInput {
  id: string
  title?: string
  url?: string
  schema?: string
  category?: string
  sub_category?: string
  project_id?: string
  sub_project_id?: string
  source?: string
}

/**
 * Fetch all document metadata from user's Supabase
 * Returns documents from their document_metadata table
 */
export async function getUserDocuments(
  userId: string,
  filters?: {
    projectId?: string
    subProjectId?: string
    category?: string
    subCategory?: string
    source?: string
  }
): Promise<{
  success: boolean
  documents?: DocumentMetadata[]
  error?: string
}> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    let query = supabase
      .from('document_metadata')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters if provided
    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId)
    }
    if (filters?.subProjectId) {
      query = query.eq('sub_project_id', filters.subProjectId)
    }
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.subCategory) {
      query = query.eq('sub_category', filters.subCategory)
    }
    if (filters?.source) {
      query = query.eq('source', filters.source)
    }

    const { data, error } = await query

    if (error) {
      // Check if table doesn't exist
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: false,
          error: 'document_metadata table not found. Please create it in your Supabase.'
        }
      }
      return { success: false, error: error.message }
    }

    return { success: true, documents: data as DocumentMetadata[] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch documents'
    }
  }
}

/**
 * Get a single document by ID
 */
export async function getUserDocument(
  userId: string,
  documentId: string
): Promise<{
  success: boolean
  document?: DocumentMetadata
  error?: string
}> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    const { data, error } = await supabase
      .from('document_metadata')
      .select('*')
      .eq('id', documentId)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, document: data as DocumentMetadata }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch document'
    }
  }
}

/**
 * Insert or update document metadata in user's Supabase
 * Used when saving files from projects or uploads
 */
export async function saveDocumentMetadata(
  userId: string,
  document: DocumentMetadataInput
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    const { error } = await supabase
      .from('document_metadata')
      .upsert({
        id: document.id,
        title: document.title || null,
        url: document.url || null,
        schema: document.schema || null,
        category: document.category || null,
        sub_category: document.sub_category || null,
        project_id: document.project_id || null,
        sub_project_id: document.sub_project_id || null,
        source: document.source || 'project',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save document metadata'
    }
  }
}

/**
 * Delete document metadata from user's Supabase
 */
export async function deleteDocumentMetadata(
  userId: string,
  documentId: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    const { error } = await supabase
      .from('document_metadata')
      .delete()
      .eq('id', documentId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete document'
    }
  }
}

/**
 * Sync a project file to user's document_metadata table
 * Called when a file is saved to a project
 */
export async function syncFileToDocumentMetadata(
  userId: string,
  fileId: string,
  fileName: string,
  storagePath: string,
  projectId?: string,
  subProjectId?: string,
  category?: string,
  subCategory?: string
): Promise<{
  success: boolean
  error?: string
}> {
  // Build the public URL or storage path
  const fileUrl = storagePath // You may want to generate a signed URL here

  return saveDocumentMetadata(userId, {
    id: fileId,
    title: fileName,
    url: fileUrl,
    schema: 'document',
    category: category || 'documents',
    sub_category: subCategory,
    project_id: projectId,
    sub_project_id: subProjectId,
    source: 'project'
  })
}

/**
 * Check if document_metadata table exists in user's Supabase
 */
export async function checkDocumentMetadataTable(
  userId: string
): Promise<{
  exists: boolean
  error?: string
}> {
  try {
    const supabase = await createSupabaseAdminClient(userId)

    // Try to query the table
    const { error } = await supabase
      .from('document_metadata')
      .select('id', { count: 'exact', head: true })

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return { exists: false }
      }
      return { exists: false, error: error.message }
    }

    return { exists: true }
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Failed to check table'
    }
  }
}

/**
 * SQL to create the document_metadata table
 * Users should run this in their Supabase SQL Editor
 */
export const DOCUMENT_METADATA_TABLE_SQL = `
-- Create document_metadata table for OTO Reach integration
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS document_metadata (
    id TEXT PRIMARY KEY,
    title TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    schema TEXT,
    category TEXT,          -- Category for organization (e.g., 'documents', 'images')
    sub_category TEXT,      -- Sub-category (e.g., 'reports', 'invoices')
    project_id TEXT,        -- Links to project (optional)
    sub_project_id TEXT,    -- Links to sub-project (optional)
    source TEXT             -- 'upload', 'project', 'chat', 'import'
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_document_metadata_project_id ON document_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_document_metadata_sub_project_id ON document_metadata(sub_project_id);
CREATE INDEX IF NOT EXISTS idx_document_metadata_category ON document_metadata(category);
CREATE INDEX IF NOT EXISTS idx_document_metadata_sub_category ON document_metadata(sub_category);
CREATE INDEX IF NOT EXISTS idx_document_metadata_source ON document_metadata(source);
CREATE INDEX IF NOT EXISTS idx_document_metadata_created_at ON document_metadata(created_at DESC);

-- Enable Row Level Security (optional - customize as needed)
ALTER TABLE document_metadata ENABLE ROW LEVEL SECURITY;

-- Policy to allow all access (customize for your security needs)
CREATE POLICY "Allow all" ON document_metadata
  FOR ALL USING (true)
  WITH CHECK (true);
`
