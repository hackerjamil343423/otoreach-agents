# Supabase Integration - Quick Reference

## 🔑 Key Concepts

| Concept | Description |
|---------|-------------|
| **Service Role Secret** | Admin-level key with full database access (bypasses RLS) |
| **Anon Key** | Public key respecting Row Level Security policies |
| **document_metadata** | User-created table for chat file selector |
| **oto_* tables** | System-created tables in user's Supabase |

---

## 📁 Essential Files

### Core Logic
```
src/lib/supabase/
├── client.ts              # Create Supabase clients
├── database.ts            # Manage user's Supabase tables
├── documentMetadata.ts    # ⭐ document_metadata operations
├── files.ts               # File storage + metadata sync
└── encryption.ts          # AES-GCM encryption
```

### API Routes
```
src/app/api/
├── admin/users/[id]/supabase-config/        # CRUD config
├── admin/users/[id]/supabase-config/test    # Test connection
├── admin/users/[id]/supabase-config/init    # ⭐ Initialize schema
└── user/documents/                          # ⭐ Get/save documents
```

### UI Components
```
src/components/
├── admin/UserIntegrations.tsx   # Admin configuration UI
└── chat/chat.tsx                # Chat with file selector

src/hooks/
└── useUserDocuments.ts          # ⭐ React hook for documents
```

---

## 🚀 Common Tasks

### 1. Configure User's Supabase (Admin)

```bash
# 1. Set encryption key
SUPABASE_ENCRYPTION_KEY=your-32-char-key

# 2. Run migration
GET /api/db/migrate

# 3. In Admin UI:
# - Enter Supabase URL
# - Enter Service Role Secret
# - Enable "Use Service Role"
# - Save & Test
# - Initialize Schema
```

### 2. Fetch Documents in Chat

```typescript
import { useUserDocuments } from '@/hooks/useUserDocuments'

const { documents, loading, setupRequired } = useUserDocuments({
  projectId: 'optional-filter',
  source: 'project'
})
```

### 3. Save File with Metadata Sync

```typescript
import { saveFile } from '@/lib/supabase/files'

await saveFile(userId, {
  id: 'file-uuid',
  subProjectId: 'sub-project-uuid',
  name: 'document.pdf',
  fileType: 'pdf',
  content: fileContent
})
// Automatically syncs to document_metadata
```

### 4. Query User's Supabase Directly

```typescript
import { createSupabaseAdminClient } from '@/lib/supabase/client'

const supabase = await createSupabaseAdminClient(userId)
const { data, error } = await supabase
  .from('any_table')
  .select('*')
```

### 5. Check document_metadata Table

```typescript
import { checkDocumentMetadataTable } from '@/lib/supabase/documentMetadata'

const { exists } = await checkDocumentMetadataTable(userId)
if (!exists) {
  // Show setup instructions
}
```

---

## 📊 Database Schema

### user_supabase_config (Neon)
```sql
id                      UUID PRIMARY KEY
user_id                 UUID REFERENCES users(id)
supabase_url            JSONB (encrypted)
supabase_anon_key       JSONB (encrypted) -- Optional
service_role_secret     JSONB (encrypted) -- ⭐ NEW
project_bucket_name     TEXT DEFAULT 'projects'
is_configured           BOOLEAN DEFAULT FALSE
use_service_role        BOOLEAN DEFAULT FALSE -- ⭐ NEW
schema_initialized      BOOLEAN DEFAULT FALSE -- ⭐ NEW
last_verified_at        TIMESTAMP
created_at              TIMESTAMP
updated_at              TIMESTAMP
```

### document_metadata (User's Supabase) ⭐
```sql
id               TEXT PRIMARY KEY
title            TEXT
url              TEXT
created_at       TIMESTAMP DEFAULT NOW()
schema           TEXT
project_id       TEXT  -- Links to project
sub_project_id   TEXT  -- Links to sub-project
source           TEXT  -- 'project', 'upload', 'chat'
```

---

## 🔌 API Reference

### GET /api/user/documents
```typescript
// Query params
{ projectId?, subProjectId?, source? }

// Response
{ documents: DocumentMetadata[], count: number }

// Error (table not found)
{ error: 'document_metadata table not found', setupRequired: true, sql: '...' }
```

### POST /api/user/documents
```typescript
// Body
{ id, title?, url?, schema?, project_id?, sub_project_id?, source? }

// Response
{ success: true }
```

### POST /api/admin/users/[id]/supabase-config/test
```typescript
// Response
{
  success: true,
  credentialType: 'service_role',
  isAdmin: true,
  schemaStatus: {
    initialized: true,
    existingTables: ['oto_chats', 'oto_messages', ...],
    missingTables: []
  }
}
```

---

## ⚠️ Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `document_metadata table not found` | User hasn't created table | Show SQL setup script |
| `Supabase not configured for user` | No credentials saved | Configure in Admin panel |
| `Connection failed` | Invalid Service Role Secret | Re-enter credentials |
| `Schema initialization failed` | Permissions issue | Run SQL manually |

---

## 🛡️ Security Checklist

- [ ] `SUPABASE_ENCRYPTION_KEY` is set and 32+ characters
- [ ] Service Role Secret never logged or exposed to client
- [ ] All API endpoints validate authentication
- [ ] User's document_metadata has appropriate RLS policies
- [ ] Credentials encrypted at rest (AES-GCM)

---

## 📈 Migration Status

| Migration | Description | Status |
|-----------|-------------|--------|
| v1 | Initial admin schema | ✅ Applied |
| v2 | Add sessions table | ✅ Applied |
| v3 | Add rate limits | ✅ Applied |
| v4 | Add session_id to chats | ✅ Applied |
| v5 | Simplify agent tables | ✅ Applied |
| v6 | Projects feature | ✅ Applied |
| v7 | ⭐ Add service_role_secret | **Run /api/db/migrate** |

---

## 📞 Support Resources

1. **Full Report:** `SUPABASE_INTEGRATION_REPORT.md`
2. **SQL Setup:** Run `GET /api/admin/users/[id]/supabase-config/init`
3. **Test Connection:** Use Admin UI "Test Connection" button

---

*Last Updated: February 7, 2026*
