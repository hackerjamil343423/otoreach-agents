import { createSupabaseClient, ensureProjectBucket } from './client'
import { sql } from '../db'
import { saveDocumentMetadata } from './documentMetadata'

export interface FileMetadata {
  id: string
  subProjectId: string
  name: string
  fileType: 'text' | 'markdown'
  content: string
  category?: string
  subCategory?: string
}

export interface StoredFileMetadata {
  id: string
  sub_project_id: string
  name: string
  file_type: string
  supabase_storage_path: string
  size_bytes: number
  created_at: Date
  updated_at: Date
}

export interface FileContent {
  content: string
  metadata: StoredFileMetadata
}

/**
 * Save a file to Supabase and store metadata in Neon DB
 * Also syncs metadata to user's Supabase document_metadata table
 */
export async function saveFile(
  userId: string,
  metadata: FileMetadata,
  options?: { skipDocumentMetadata?: boolean }
): Promise<string> {
  console.log('[saveFile] Starting file save:', { userId, fileId: metadata.id, name: metadata.name })

  let supabase
  try {
    supabase = await createSupabaseClient(userId)
    console.log('[saveFile] Supabase client created successfully')
  } catch (error) {
    console.error('[saveFile] Failed to create Supabase client:', error)
    throw new Error('Supabase not configured. Please contact support to set up your account.')
  }

  // Try to ensure project bucket exists (may fail if user doesn't have service role)
  // The bucket might already exist, so we continue even if this fails
  try {
    await ensureProjectBucket(userId)
    console.log('[saveFile] Project bucket ensured')
  } catch (bucketError) {
    console.warn('[saveFile] Could not ensure project bucket (might already exist):', bucketError)
    // Continue anyway - the bucket might already exist
  }

  // Generate storage path
  const storagePath = `${userId}/${metadata.subProjectId}/${metadata.id}/${metadata.name}`
  console.log('[saveFile] Storage path:', storagePath)

  // Upload to Supabase (convert content to Blob)
  const encoder = new TextEncoder()
  const uint8Array = encoder.encode(metadata.content)
  const blob = new Blob([uint8Array], { type: 'text/plain' })

  const { error: uploadError } = await supabase.storage
    .from('projects')
    .upload(storagePath, blob, {
      upsert: true,
      cacheControl: '3600'
    })

  if (uploadError) {
    console.error('[saveFile] Supabase upload error:', uploadError)
    // Check if it's a permission error
    if (uploadError.message.includes('permission') || uploadError.message.includes('Policy')) {
      throw new Error('Permission denied. Please contact support to check your Supabase permissions.')
    }
    // Check if bucket doesn't exist
    if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
      throw new Error('Storage bucket not found. Please contact support to set up your storage.')
    }
    throw new Error(`Failed to upload file: ${uploadError.message}`)
  }
  console.log('[saveFile] File uploaded to Supabase')

  // Save metadata to Neon DB (without category - categories are stored in user's Supabase only)
  try {
    await sql`
      INSERT INTO project_files (id, sub_project_id, name, file_type, supabase_storage_path, size_bytes)
      VALUES (${metadata.id}, ${metadata.subProjectId}, ${metadata.name}, ${metadata.fileType}, ${storagePath}, ${metadata.content.length})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        file_type = EXCLUDED.file_type,
        supabase_storage_path = EXCLUDED.supabase_storage_path,
        size_bytes = EXCLUDED.size_bytes,
        updated_at = NOW()
    `
    console.log('[saveFile] Metadata saved to Neon DB')
  } catch (dbError) {
    console.error('[saveFile] Failed to save metadata to Neon:', dbError)
    throw new Error('Failed to save file metadata to database')
  }

  // Also sync to user's Supabase document_metadata table
  if (!options?.skipDocumentMetadata) {
    try {
      // Get project_id from sub_project_id
      const subProjectResult = await sql`
        SELECT sp.project_id, sp.id as sub_project_id
        FROM sub_projects sp
        WHERE sp.id = ${metadata.subProjectId}
      `

      const projectId = subProjectResult.length > 0 && subProjectResult[0]
        ? subProjectResult[0].project_id as string
        : undefined

      // Use provided category or default to 'documents'
      const fileCategory = metadata.category || 'documents'
      const fileSubCategory = metadata.subCategory || undefined

      // Save to user's document_metadata table
      await saveDocumentMetadata(userId, {
        id: metadata.id,
        title: metadata.name,
        url: storagePath,
        schema: metadata.fileType,
        category: fileCategory,
        sub_category: fileSubCategory,
        project_id: projectId,
        sub_project_id: metadata.subProjectId,
        source: 'project'
      })
      console.log('[saveFile] Document metadata synced')
    } catch (syncError) {
      // Log but don't fail the file save if document_metadata sync fails
      console.warn('[saveFile] Failed to sync to document_metadata:', syncError)
    }
  }

  console.log('[saveFile] File saved successfully:', { fileId: metadata.id })
  return storagePath
}

/**
 * Load a file from Supabase with metadata from Neon DB
 */
export async function loadFile(userId: string, fileId: string): Promise<FileContent> {
  const supabase = await createSupabaseClient(userId)

  // Get metadata from Neon DB
  const result = await sql`
    SELECT * FROM project_files WHERE id = ${fileId}
  `

  if (result.length === 0) {
    throw new Error('File not found')
  }

  const metadata = result[0] as StoredFileMetadata

  // Download from Supabase
  const { data, error } = await supabase.storage
    .from('projects')
    .download(metadata.supabase_storage_path)

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`)
  }

  const content = await data.text()

  return { content, metadata }
}

/**
 * Delete a file from Supabase and remove metadata from Neon DB
 */
export async function deleteFile(userId: string, fileId: string): Promise<void> {
  const supabase = await createSupabaseClient(userId)

  // Get storage path
  const result = await sql`
    SELECT supabase_storage_path FROM project_files WHERE id = ${fileId}
  `

  if (result.length > 0 && result[0]) {
    const storagePath = result[0].supabase_storage_path!

    // Delete from Supabase
    const { error } = await supabase.storage
      .from('projects')
      .remove([storagePath])

    if (error) {
      console.error(`Failed to delete file from Supabase: ${error.message}`)
    }

    // Delete metadata from Neon
    await sql`DELETE FROM project_files WHERE id = ${fileId}`
  }
}

/**
 * List all files in a sub-project
 */
export async function listFiles(subProjectId: string): Promise<StoredFileMetadata[]> {
  const result = await sql`
    SELECT * FROM project_files
    WHERE sub_project_id = ${subProjectId}
    ORDER BY name ASC
  `

  return result as StoredFileMetadata[]
}

/**
 * Get file metadata without loading content
 */
export async function getFileMetadata(fileId: string): Promise<StoredFileMetadata | null> {
  const result = await sql`
    SELECT * FROM project_files WHERE id = ${fileId}
  `

  return result.length > 0 ? (result[0] as StoredFileMetadata) : null
}
