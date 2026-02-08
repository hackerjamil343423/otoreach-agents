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
  const supabase = await createSupabaseClient(userId)
  await ensureProjectBucket(userId)

  // Generate storage path
  const storagePath = `${userId}/${metadata.subProjectId}/${metadata.id}/${metadata.name}`

  // Upload to Supabase (convert content to Blob)
  const encoder = new TextEncoder()
  const uint8Array = encoder.encode(metadata.content)
  const blob = new Blob([uint8Array], { type: 'text/plain' })

  const { error } = await supabase.storage
    .from('projects')
    .upload(storagePath, blob)

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  // Save metadata to Neon DB
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

      // Save to user's document_metadata table
      await saveDocumentMetadata(userId, {
        id: metadata.id,
        title: metadata.name,
        url: storagePath,
        schema: metadata.fileType,
        category: metadata.category || 'documents',
        sub_category: metadata.subCategory,
        project_id: projectId,
        sub_project_id: metadata.subProjectId,
        source: 'project'
      })
    } catch (syncError) {
      // Log but don't fail the file save if document_metadata sync fails
      console.warn('Failed to sync to document_metadata:', syncError)
    }
  }

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
