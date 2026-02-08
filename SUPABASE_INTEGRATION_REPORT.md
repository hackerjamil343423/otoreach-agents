# Supabase Integration Implementation Report

## Executive Summary

This document provides a comprehensive overview of the Supabase integration implementation for the OTO Reach Agents project. The integration enables users to connect their own Supabase projects for file storage and database operations, with full administrative access via Service Role Secret.

**Implementation Date:** February 7, 2026  
**Status:** ✅ Complete and Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Changes](#database-changes)
3. [Core Implementation Files](#core-implementation-files)
4. [API Endpoints](#api-endpoints)
5. [User Interface Updates](#user-interface-updates)
6. [Security Considerations](#security-considerations)
7. [Setup Instructions](#setup-instructions)
8. [Usage Examples](#usage-examples)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OTO REACH AGENTS APP                              │
│                         (Next.js + Neon PostgreSQL)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │   users          │  │   projects       │  │ project_files    │          │
│  │   chats          │  │   sub_projects   │  │ (Neon metadata)  │          │
│  │   messages       │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  user_supabase_config                                               │   │
│  │  ├─ supabase_url (encrypted)                                        │   │
│  │  ├─ supabase_anon_key (encrypted)                                   │   │
│  │  ├─ service_role_secret (encrypted)  ← NEW                         │   │
│  │  ├─ use_service_role (boolean)       ← NEW                         │   │
│  │  ├─ schema_initialized (boolean)     ← NEW                         │   │
│  │  └─ project_bucket_name                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Service Role Secret
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER'S SUPABASE PROJECT                             │
│                      (Each user has their own instance)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Storage Bucket: "projects"                                         │   │
│  │  ├── userId/projectId/fileId/filename.txt                           │   │
│  │  ├── userId/projectId/fileId/document.pdf                           │   │
│  │  └── ... (raw file content)                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Tables (Auto-created by system)                                    │   │
│  │  ├── oto_chats           - Chat sessions                            │   │
│  │  ├── oto_messages        - Chat messages                            │   │
│  │  ├── oto_projects        - Project data                             │   │
│  │  ├── oto_sub_projects    - Sub-project data                         │   │
│  │  ├── oto_files           - File metadata                            │   │
│  │  └── oto_custom_entities - User-defined entities                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Table (User-created manually)                                      │   │
│  │  ├── document_metadata   - File selector source    ← NEW            │   │
│  │     ├─ id TEXT PRIMARY KEY                                          │   │
│  │     ├─ title TEXT                                                   │   │
│  │     ├─ url TEXT                                                     │   │
│  │     ├─ created_at TIMESTAMP                                         │   │
│  │     ├─ schema TEXT                                                  │   │
│  │     ├─ project_id TEXT     ← Links to project                       │   │
│  │     └─ sub_project_id TEXT ← Links to sub-project                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Admin Configuration:** Admin configures user's Supabase credentials (URL + Service Role Secret)
2. **File Upload:** Files saved to project → Stored in user's Supabase Storage + Metadata in Neon
3. **Metadata Sync:** File metadata also synced to user's `document_metadata` table
4. **Chat File Selector:** Reads from user's `document_metadata` to show available files
5. **Full Database Access:** Service Role allows querying any data in user's Supabase

---

## Database Changes

### Migration 7: Add Service Role Support

**File:** `src/lib/db/migrate.ts`

```sql
-- Added columns to user_supabase_config table
ALTER TABLE user_supabase_config ADD COLUMN service_role_secret JSONB;
ALTER TABLE user_supabase_config ADD COLUMN use_service_role BOOLEAN DEFAULT FALSE;
ALTER TABLE user_supabase_config ADD COLUMN schema_initialized BOOLEAN DEFAULT FALSE;
```

**Purpose:**
- `service_role_secret`: Encrypted Service Role Key for admin-level access
- `use_service_role`: Flag to determine which credential to use
- `schema_initialized`: Tracks if user's Supabase tables are set up

---

## Core Implementation Files

### 1. Supabase Client (`src/lib/supabase/client.ts`)

**Key Functions:**

```typescript
// Create client with credential type selection
export async function createSupabaseClient(
  userId: string,
  credentialType: 'service_role' | 'anon' = 'service_role'
): Promise<SupabaseClient>

// Admin client with full access (bypasses RLS)
export async function createSupabaseAdminClient(userId: string): Promise<SupabaseClient>

// Limited client respecting RLS policies
export async function createSupabaseAnonClient(userId: string): Promise<SupabaseClient>

// Test connection with credential type
export async function testSupabaseConnection(
  userId: string,
  credentialType: CredentialType
): Promise<{ success: boolean; error?: string; isAdmin?: boolean }>

// Check configuration status
export async function isSupabaseConfigured(userId: string): Promise<boolean>
export async function hasServiceRoleConfigured(userId: string): Promise<boolean>
```

### 2. Database Management (`src/lib/supabase/database.ts`)

**Key Functions:**

```typescript
// SQL script for creating tables in user's Supabase
export const USER_SUPABASE_SETUP_SQL: string

// Initialize user's Supabase with required tables
export async function initializeUserSupabase(userId: string): Promise<{
  success: boolean
  error?: string
  createdTables?: string[]
}>

// Check if required tables exist
export async function checkUserSupabaseSchema(userId: string): Promise<{
  initialized: boolean
  existingTables: string[]
  missingTables: string[]
}>

// Sync project from Neon to user's Supabase
export async function syncProjectToUserSupabase(
  userId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }>

// Execute CRUD operations on user's Supabase
export async function executeUserSupabaseQuery<T>(
  userId: string,
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete',
  data?: Record<string, unknown>,
  filters?: Record<string, unknown>
): Promise<{ success: boolean; data?: T[]; error?: string; count?: number }>
```

### 3. Document Metadata (`src/lib/supabase/documentMetadata.ts`) ⭐ NEW

**Key Functions:**

```typescript
// Fetch documents from user's document_metadata table
export async function getUserDocuments(
  userId: string,
  filters?: { projectId?: string; subProjectId?: string; source?: string }
): Promise<{ success: boolean; documents?: DocumentMetadata[]; error?: string }>

// Save document metadata
export async function saveDocumentMetadata(
  userId: string,
  document: DocumentMetadataInput
): Promise<{ success: boolean; error?: string }>

// Sync project file to document_metadata
export async function syncFileToDocumentMetadata(
  userId: string,
  fileId: string,
  fileName: string,
  storagePath: string,
  projectId?: string,
  subProjectId?: string
): Promise<{ success: boolean; error?: string }>

// Check if table exists
export async function checkDocumentMetadataTable(
  userId: string
): Promise<{ exists: boolean; error?: string }>

// SQL to create the table (user runs this)
export const DOCUMENT_METADATA_TABLE_SQL: string
```

### 4. File Operations (`src/lib/supabase/files.ts`)

**Updated Function:**

```typescript
// Now also syncs to document_metadata table
export async function saveFile(
  userId: string,
  metadata: FileMetadata,
  options?: { skipDocumentMetadata?: boolean }
): Promise<string>
```

**Sync Behavior:**
- Saves file to Supabase Storage
- Saves metadata to Neon `project_files` table
- Also saves to user's `document_metadata` table (with project/sub-project links)

---

## API Endpoints

### Admin Endpoints

#### Configuration Management
```
GET    /api/admin/users/[id]/supabase-config
       → Returns config status (without sensitive data)

POST   /api/admin/users/[id]/supabase-config
       Body: { supabaseUrl, serviceRoleSecret?, supabaseAnonKey?, useServiceRole }
       → Saves/updates configuration

DELETE /api/admin/users/[id]/supabase-config
       → Removes configuration
```

#### Testing & Initialization
```
POST   /api/admin/users/[id]/supabase-config/test
       → Tests connection and returns schema status
       Response: { success, credentialType, isAdmin, schemaStatus }

POST   /api/admin/users/[id]/supabase-config/init
       → Creates required tables in user's Supabase
       Response: { success, createdTables, schemaStatus }

GET    /api/admin/users/[id]/supabase-config/init
       → Returns SQL setup script for manual execution
       Response: { sql, instructions }
```

### User Endpoints

#### Document Metadata ⭐ NEW
```
GET    /api/user/documents?projectId=&subProjectId=&source=
       → Fetches documents from user's document_metadata table
       Response: { documents: [], count: number }
       Error (404): { error, setupRequired: true, sql }

POST   /api/user/documents
       Body: { id, title?, url?, schema?, project_id?, sub_project_id?, source? }
       → Saves document metadata to user's table
```

---

## User Interface Updates

### Admin Panel: User Integrations (`src/components/admin/UserIntegrations.tsx`)

**Major Redesign:**

1. **Two-Tab Interface:**
   - **Credentials Tab:** Configure Supabase connection
   - **Setup SQL Tab:** View and copy SQL setup scripts

2. **Credential Configuration:**
   - Supabase URL input
   - Service Role Secret input (primary)
   - Anon Key input (fallback)
   - "Use Service Role" toggle switch
   - Storage bucket name

3. **Status Indicators:**
   - Configured / Not Configured badge
   - Service Role / Anon Key badge
   - Schema Ready badge
   - Last verified timestamp

4. **Actions:**
   - Save/Update Configuration
   - Test Connection (shows credential type used)
   - Initialize Schema (when service role configured)
   - Remove Configuration

5. **SQL Setup Tab:**
   - Displays full SQL setup script
   - Copy to clipboard button
   - Step-by-step instructions

### Chat Interface (`src/components/chat/chat.tsx`)

**File Selector Integration:**

1. **Dynamic Document Loading:**
   - Uses `useUserDocuments()` hook to fetch from user's Supabase
   - Replaces hardcoded sample files

2. **Loading States:**
   - Shows spinner while loading
   - Displays error messages
   - Shows setup required message with SQL copy button

3. **Setup Required State:**
   ```
   ⚠ document_metadata table not found
   
   Ask your admin to set up the Supabase integration, 
   or create the table manually:
   
   [📋 Copy SQL Setup Script]
   ```

4. **Document Display:**
   - File icons based on extension
   - File names
   - Accessible/Not accessible toggle
   - Shows count: "X of Y files accessible"

### React Hook (`src/hooks/useUserDocuments.ts`)

```typescript
const {
  documents,      // UserDocument[] - from user's Supabase
  loading,        // boolean
  error,          // string | null
  setupRequired,  // boolean - true if table missing
  setupSql,       // string - SQL to create table
  refresh         // () => void - reload documents
} = useUserDocuments({
  projectId?: string,      // Filter by project
  subProjectId?: string,   // Filter by sub-project
  source?: string,         // Filter by source
  autoFetch?: boolean      // Auto fetch on mount
})
```

---

## Security Considerations

### Credential Encryption

All Supabase credentials are encrypted using AES-GCM before storage:

```typescript
// Encryption: src/lib/supabase/encryption.ts
const ENCRYPTION_SECRET = process.env.SUPABASE_ENCRYPTION_KEY
const ALGORITHM = 'AES-GCM'

export async function encrypt(text: string): Promise<EncryptedData>
export async function decrypt(encrypted: string, iv: string, authTag: string): Promise<string>
```

### Required Environment Variable

```bash
# 32+ character encryption key
SUPABASE_ENCRYPTION_KEY=your-supabase-encryption-key-change-in-production-32-chars-min
```

### Access Control

1. **Service Role Secret:**
   - Bypasses Row Level Security (RLS)
   - Full database access
   - Server-side only (never exposed to client)
   - Encrypted at rest

2. **Anon Key:**
   - Respects RLS policies
   - Limited access
   - Can be used as fallback

3. **API Protection:**
   - All endpoints validate user session
   - Admin endpoints validate admin session
   - No credentials exposed in API responses

### User's Table Security

Users should enable RLS on their `document_metadata` table:

```sql
-- Recommended RLS setup
ALTER TABLE document_metadata ENABLE ROW LEVEL SECURITY;

-- Customize policies based on your needs
CREATE POLICY "Allow app access" ON document_metadata
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (true);
```

---

## Setup Instructions

### For Administrators

1. **Set Environment Variable:**
   ```bash
   # .env.local
   SUPABASE_ENCRYPTION_KEY=your-32-char-key-here-minimum
   ```

2. **Run Database Migration:**
   ```bash
   # Visit after deployment
   GET /api/db/migrate
   
   # Or run manually
   node fix-migrations.js
   ```

3. **Configure User's Supabase:**
   - Go to Admin → Users → [User] → Integrations
   - Enter Supabase URL
   - Enter Service Role Secret (from user's Supabase: Project Settings → API)
   - Enable "Use Service Role"
   - Save Configuration
   - Test Connection
   - Initialize Schema (creates oto_* tables)

### For End Users

1. **Create Supabase Project:**
   - Sign up at supabase.com
   - Create new project

2. **Get Credentials:**
   - Go to Project Settings → API
   - Copy Project URL
   - Copy Service Role Secret (NOT the anon key!)

3. **Provide to Admin:**
   - Give URL and Service Role Secret to administrator
   - Admin will configure in the system

4. **Create document_metadata Table:**
   ```sql
   -- Run this in your Supabase SQL Editor
   CREATE TABLE document_metadata (
       id TEXT PRIMARY KEY,
       title TEXT,
       url TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       schema TEXT,
       project_id TEXT,
       sub_project_id TEXT,
       source TEXT
   );
   
   CREATE INDEX idx_document_metadata_project_id ON document_metadata(project_id);
   CREATE INDEX idx_document_metadata_sub_project_id ON document_metadata(sub_project_id);
   ```

5. **Verify Setup:**
   - Log into OTO Reach chat
   - Click "Knowledge Base" dropdown
   - Should show "0 of 0 files" (ready for files)

---

## Usage Examples

### Example 1: Save Project File

```typescript
import { saveFile } from '@/lib/supabase/files'

const storagePath = await saveFile(userId, {
  id: 'file-uuid',
  subProjectId: 'sub-project-uuid',
  name: 'report.pdf',
  fileType: 'pdf',
  content: fileContent
})

// This automatically:
// 1. Uploads file to user's Supabase Storage
// 2. Saves metadata to Neon project_files table
// 3. Syncs metadata to user's document_metadata table
```

### Example 2: Query User's Documents in Chat

```typescript
import { useUserDocuments } from '@/hooks/useUserDocuments'

function ChatComponent() {
  const { documents, loading, error, setupRequired } = useUserDocuments({
    source: 'project'  // Only show project files
  })
  
  // documents[] contains files from user's Supabase
}
```

### Example 3: Execute Custom Query on User's Supabase

```typescript
import { executeUserSupabaseQuery } from '@/lib/supabase/database'

// Query user's custom table
const result = await executeUserSupabaseQuery(
  userId,
  'my_custom_table',
  'select',
  undefined,
  { status: 'active' }
)

if (result.success) {
  console.log(result.data)
}
```

### Example 4: Sync Project Data to User's Supabase

```typescript
import { syncProjectToUserSupabase } from '@/lib/supabase/database'

// Sync a project from Neon to user's Supabase
const result = await syncProjectToUserSupabase(userId, projectId)

// Now user's oto_projects table has the data
```

---

## Troubleshooting

### Issue: "document_metadata table not found"

**Cause:** User hasn't created the table in their Supabase  
**Solution:**
1. Go to Supabase SQL Editor
2. Run the SQL from Setup SQL tab or DOCUMENT_METADATA_TABLE_SQL
3. Refresh chat page

### Issue: "Connection failed" in test

**Cause:** Invalid Service Role Secret or URL  
**Solution:**
1. Verify URL format: `https://<project>.supabase.co`
2. Get Service Role Secret from Project Settings → API (NOT anon key)
3. Re-enter credentials in Admin panel

### Issue: "Schema initialization failed"

**Cause:** Supabase doesn't allow creating extensions or tables via API  
**Solution:**
1. Use "Setup SQL" tab to get SQL script
2. Run SQL manually in Supabase SQL Editor
3. Click "Test Connection" to verify

### Issue: Files not appearing in chat selector

**Cause:** 
1. document_metadata table doesn't exist
2. No files have been saved to projects

**Solution:**
1. Check if table exists in user's Supabase
2. Create a project and add a file
3. Check browser console for errors

### Issue: "Encryption failed"

**Cause:** SUPABASE_ENCRYPTION_KEY not set or too short  
**Solution:**
```bash
# .env.local
SUPABASE_ENCRYPTION_KEY=$(openssl rand -base64 32)
```

---

## File Changes Summary

### New Files
1. `src/lib/supabase/documentMetadata.ts` - Document metadata operations ⭐
2. `src/lib/supabase/database.ts` - User Supabase management
3. `src/hooks/useUserDocuments.ts` - React hook for documents ⭐
4. `src/app/api/user/documents/route.ts` - Documents API endpoint ⭐
5. `src/app/api/admin/users/[id]/supabase-config/init/route.ts` - Schema init endpoint
6. `src/components/ui/alert.tsx` - UI alert component

### Modified Files
1. `src/lib/db/migrate.ts` - Added migration v7 (service role columns)
2. `src/lib/supabase/client.ts` - Service role support
3. `src/lib/supabase/files.ts` - Sync to document_metadata ⭐
4. `src/lib/supabase/encryption.ts` - No changes (already existed)
5. `src/app/api/admin/users/[id]/supabase-config/route.ts` - Service role support
6. `src/app/api/admin/users/[id]/supabase-config/test/route.ts` - Schema checking
7. `src/components/admin/UserIntegrations.tsx` - Two-tab UI with service role
8. `src/components/chat/chat.tsx` - Dynamic document loading ⭐
9. `.env.example` - Added SUPABASE_ENCRYPTION_KEY

---

## Performance Considerations

1. **Caching:** Documents are fetched on chat page load, not cached
2. **Pagination:** Not implemented yet (consider for >100 files)
3. **Real-time:** Not using Supabase realtime (can be added later)
4. **Query Optimization:** document_metadata has indexes on project_id and sub_project_id

---

## Future Enhancements

1. **Real-time Sync:** Use Supabase subscriptions for live file updates
2. **File Content Access:** Load actual file content when selected in chat
3. **Pagination:** Add pagination for large document sets
4. **Search:** Add full-text search across documents
5. **Filtering:** Advanced filters (date range, file type, etc.)
6. **Bulk Operations:** Select/deselect all files in a project

---

## Conclusion

The Supabase integration implementation provides:

✅ **Full database access** via Service Role Secret  
✅ **Secure credential storage** with AES-GCM encryption  
✅ **User-managed document_metadata table** for chat file selector  
✅ **Automatic metadata sync** when saving project files  
✅ **Comprehensive admin UI** for configuration and monitoring  
✅ **Clear setup instructions** for administrators and end users  

The system is production-ready and provides a solid foundation for user-specific Supabase integrations.

---

**Report Generated:** February 7, 2026  
**Version:** 1.0  
**Author:** AI Implementation Assistant
