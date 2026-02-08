# File Storage Architecture

## Where Are Project Files Saved?

Project files are stored in **TWO locations**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         1. NEON POSTGRESQL                                  │
│                    (Metadata & Organization)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  project_files table:                                                       │
│  ┌─────────────┬──────────────┬───────────┬─────────────┬─────────────────┐ │
│  │ id          │ name         │ description│ file_type  │ size_bytes      │ │
│  │ sub_project_id│ supabase_storage_path │ created_at │ updated_at       │ │
│  └─────────────┴──────────────┴───────────┴─────────────┴─────────────────┘ │
│                                                                             │
│  Example:                                                                   │
│  • File ID: abc-123                                                         │
│  • Name: "report.txt"                                                       │
│  • Description: "Q4 Sales Report"                                          │
│  • Storage Path: "user-id/sub-project-id/file-id/report.txt"               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Reference (storage_path)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      2. USER'S SUPABASE STORAGE                             │
│                         (Actual File Content)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Bucket: "projects"                                                         │
│                                                                             │
│  File Structure:                                                            │
│  projects/                                                                  │
│  └── {userId}/                                                              │
│      └── {subProjectId}/                                                    │
│          └── {fileId}/                                                      │
│              └── report.txt    ← Actual file content                        │
│                                                                             │
│  Example Path:                                                              │
│  "550e8400-e29b-41d4-a716-446655440000/a1b2c3d4/report.txt"               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## The Flow

### When You Create a File:

1. **Frontend** sends to `/api/user/projects/sub-projects/{id}/files`
   ```json
   {
     "name": "document.txt",
     "description": "Important notes",
     "content": "This is the file content..."
   }
   ```

2. **API** does TWO things:
   
   **A. Saves to Supabase Storage** (using Service Role Secret)
   ```typescript
   await supabase.storage
     .from('projects')
     .upload("user-id/sub-project-id/file-id/document.txt", blob)
   ```
   
   **B. Saves metadata to Neon**
   ```sql
   INSERT INTO project_files (
     id, sub_project_id, name, description, 
     file_type, supabase_storage_path, size_bytes
   ) VALUES (...)
   ```

### When You Open/Edit a File:

1. **Load metadata** from Neon (fast)
2. **Load content** from Supabase Storage
3. **Save** updates both locations

## Why This Architecture?

| Aspect | Neon (PostgreSQL) | Supabase Storage |
|--------|-------------------|------------------|
| **Purpose** | Organization, search, metadata | File content storage |
| **Speed** | Fast queries, indexing | Optimized for file delivery |
| **Cost** | Good for metadata | Good for blob storage |
| **Features** | Relations, joins, filters | CDN, public URLs, images |
| **Size** | Small (metadata only) | Large (actual file content) |

## User's Supabase Project

Each user connects their **OWN** Supabase project:

```
User A's Files → User A's Supabase Storage
User B's Files → User B's Supabase Storage
```

This means:
- ✅ Users own their data
- ✅ You don't pay for their storage
- ✅ They can access files directly in their Supabase
- ✅ They can use Supabase features (CDN, public URLs, etc.)

## Configuration Required

For this to work, each user needs:

1. **Supabase Project** (they create this)
2. **Service Role Secret** (stored encrypted in Neon)
3. **"projects" bucket** (auto-created on first upload)

## SQL for User's Supabase

If users want to see their files in Supabase Dashboard, they need this table:

```sql
-- Run in THEIR Supabase (not yours)
CREATE TABLE document_metadata (
    id TEXT PRIMARY KEY,
    title TEXT,
    url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    schema TEXT,
    category TEXT,
    sub_category TEXT,
    project_id TEXT,
    sub_project_id TEXT,
    source TEXT
);
```

This table is used by the **chat file selector** to show available files.

## Summary

| What | Where | Table/Bucket |
|------|-------|--------------|
| File name, description | Neon PostgreSQL | `project_files` |
| File content (text) | User's Supabase | `projects` bucket |
| Folder structure | Neon PostgreSQL | `projects` + `sub_projects` |
| Chat file list | User's Supabase | `document_metadata` |

## API Endpoints

| Endpoint | Purpose | Storage |
|----------|---------|---------|
| `POST /api/user/projects/{id}/sub-projects` | Create folder | Neon only |
| `POST /api/user/projects/sub-projects/{id}/files` | Create file | Neon + Supabase |
| `GET /api/user/projects/sub-projects/files/{id}` | Get file | Neon (meta) + Supabase (content) |
| `PUT /api/user/projects/sub-projects/files/{id}` | Update file | Neon + Supabase |
| `DELETE /api/user/projects/sub-projects/files/{id}` | Delete file | Neon + Supabase |
