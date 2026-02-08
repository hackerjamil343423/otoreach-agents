# OTO Reach Agents - AI Coding Agent Guide

This document provides essential information for AI coding agents working on the OTO Reach Agents project.

## Project Overview

**OTO Reach Agents** is a full-stack AI assistant application that provides a ChatGPT-like interface for interacting with configurable AI agents. The platform supports multiple users, custom AI agents with webhooks, personas, and document uploads.

### Key Features
- Multi-user chat interface with session persistence
- Configurable AI agents with custom webhook endpoints
- User personas for customized AI interactions
- Document parsing (PDF, images, Office documents)
- Admin panel for user and agent management
- Voice chat capability
- Dark/light theme support
- Responsive design

---

## Technology Stack

### Frontend
- **Framework**: [Next.js](https://nextjs.org/) 16.0.10 (App Router)
- **UI Library**: [React](https://react.dev/) 19.2.1
- **Language**: [TypeScript](https://www.typescriptlang.org/) 5.7.2 (strict mode enabled)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 4.1.4 with CSS variables
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (New York style)
- **UI Primitives**: [Radix UI](https://www.radix-ui.com/) components
- **Icons**: [Lucide React](https://lucide.dev/)
- **Forms**: React Hook Form with Zod validation

### Backend
- **Runtime**: Next.js Edge Runtime (`export const runtime = 'edge'`)
- **Output Mode**: Standalone (for Docker deployment)
- **Database**: [Neon PostgreSQL](https://neon.tech/) via `@neondatabase/serverless`
- **Authentication**: JWT-based with custom session management
- **Password Hashing**: bcryptjs

### External Services
- **AI Agents**: Configurable webhook endpoints (user-provided)
- **Analytics**: Vercel Analytics
- **Auth**: Neon Auth (JWKS for token validation) - optional

---

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (site)/             # Landing page route group
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # Authentication endpoints
│   │   │   ├── user/           # User-specific APIs
│   │   │   ├── admin/          # Admin APIs
│   │   │   ├── chat/           # Chat webhook endpoint
│   │   │   ├── db/             # Database migration APIs
│   │   │   └── parse-pdf/      # Document parsing API
│   │   ├── chat/               # Main chat page
│   │   ├── login/              # Login page
│   │   ├── register/           # Registration page
│   │   ├── settings/           # User settings
│   │   ├── voice-chat/         # Voice chat feature
│   │   └── admin/              # Admin panel
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── chat/               # Chat-related components
│   │   ├── admin/              # Admin panel components
│   │   ├── header/             # App header
│   │   ├── markdown/           # Markdown renderer
│   │   ├── voice-chat/         # Voice chat components
│   │   └── theme/              # Theme switcher
│   ├── contexts/
│   │   ├── auth.tsx            # Auth context provider
│   │   └── app.tsx             # App-wide state (sidebar, modals)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/
│   │   ├── auth/               # Authentication utilities
│   │   ├── db/                 # Database schema and migrations
│   │   ├── themes/             # Theme configurations
│   │   ├── types/              # TypeScript type definitions
│   │   ├── db.ts               # Database connection
│   │   ├── auth.ts             # Auth helper functions
│   │   ├── cache.ts            # LocalStorage cache utilities
│   │   ├── csrf.ts             # CSRF protection
│   │   ├── fileParser.ts       # Document parsing logic
│   │   ├── rate-limit.ts       # Rate limiting utilities
│   │   └── utils.ts            # General utilities (cn function)
│   ├── middleware/             # Next.js middleware
│   ├── providers/              # Context providers
│   ├── services/               # Service constants
│   └── types/                  # Global TypeScript types
├── docs/                       # Documentation assets
├── public/                     # Static assets
├── .env.example                # Environment variables template
├── Dockerfile                  # Multi-stage Docker build
├── next.config.ts              # Next.js configuration
├── components.json             # shadcn/ui configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies and scripts
```

---

## Database Schema

The application uses Neon PostgreSQL with the following tables:

### Core Tables
- **`users`** - User accounts (email, password_hash, name, avatar_url)
- **`chats`** - Chat sessions (user_id, title, session_id for webhook continuity)
- **`messages`** - Chat messages (chat_id, role, content as JSONB)
- **`personas`** - User-defined AI personas (system_prompt)

### Authentication Tables
- **`sessions`** - User session tokens with expiration
- **`admin_sessions`** - Admin session tokens

### Admin Tables
- **`admin_users`** - Admin accounts for admin panel access
- **`agents`** - Configurable AI agents (webhook_url, system_prompt, assigned_to array)
- **`user_agents`** - User-agent assignments with default flags

### Key Design Patterns
- UUID primary keys with `gen_random_uuid()`
- JSONB content for flexible message storage (supports text, images, documents)
- Array columns for agent assignments (`assigned_to UUID[]`)
- Timestamp tracking for all entities

---

## Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
# Required
DATABASE_URL=postgresql://...              # Neon PostgreSQL connection
JWT_SECRET=your-jwt-secret-min-64-chars    # Generate with: openssl rand -base64 64
AGENT_WEBHOOK_URL=https://...              # Default agent webhook URL

# Optional
NEON_AUTH_URL=...                          # Neon Auth endpoint (if using OAuth)
NEON_JWKS_URL=...                          # JWKS endpoint for token validation
NEXT_PUBLIC_DEFAULT_THEME=light            # Default theme
```

---

## Build and Development Commands

```bash
# Development
npm run dev              # Start development server (Next.js dev)

# Build
npm run build            # Production build with static export

# Production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm run format:check     # Check formatting

# Docker
npm run docker:build     # Build Docker image
```

---

## Code Style Guidelines

### TypeScript Configuration
- **Strict mode**: Enabled with additional strict options
- **No unchecked indexed access**: `noUncheckedIndexedAccess: true`
- **Path alias**: Use `@/` for imports from `src/`
- **Type imports**: Use explicit `import type` where applicable

### Prettier Configuration (`.prettierrc.json`)
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 100,
  "jsxSingleQuote": false
}
```

### Code Conventions
- **Quotes**: Single quotes for JS/TS, double quotes for JSX attributes
- **Semicolons**: Disabled
- **Trailing commas**: Disabled
- **Line width**: 100 characters
- **Imports**: Auto-sorted by `@ianvs/prettier-plugin-sort-imports`
  1. React/Next.js imports
  2. Third-party modules
  3. `@/` aliases
  4. Relative imports

### File Naming
- **Components**: PascalCase (e.g., `Chat.tsx`, `AgentForm.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useChatHook.ts`)
- **Utilities**: camelCase (e.g., `utils.ts`, `fileParser.ts`)
- **API Routes**: `route.ts` in named folders
- **Pages**: `page.tsx` in named folders

---

## Component Patterns

### Server vs Client Components
- **Server Components**: Default for pages, use for data fetching
- **Client Components**: Mark with `'use client'` for:
  - Interactivity (buttons, forms)
  - Browser APIs (localStorage, clipboard)
  - React hooks (useState, useEffect)
  - Context consumers

### Context Providers Hierarchy (from `layout.tsx`)
```tsx
<AuthProvider>        {/* Authentication state */}
  <AppContextProvider> {/* Sidebar, modals state */}
    <ThemeProvider>    {/* Dark/light theme */}
      <TooltipProvider> {/* Radix UI tooltips */}
        {/* Page content */}
      </TooltipProvider>
    </ThemeProvider>
  </AppContextProvider>
</AuthProvider>
```

### shadcn/ui Pattern
Components are generated via CLI and stored in `src/components/ui/`:
- Built on Radix UI primitives
- Styled with Tailwind CSS
- Support dark mode via CSS variables
- Use `cn()` utility for conditional classes

---

## Authentication Flow

### User Authentication
1. **Login**: `POST /api/auth/login` validates credentials, creates session
2. **Session Storage**: JWT token in HTTP-only cookie + localStorage (for UX)
3. **Validation**: Middleware checks `auth_token` cookie on protected routes
4. **Logout**: `POST /api/auth/sign-out` clears cookies and database session

### Admin Authentication
- Separate admin login at `/admin/login`
- Admin sessions stored in `admin_sessions` table
- Admin middleware validates admin-specific tokens

### Protected Routes
- User routes: `/chat`, `/settings`
- Admin routes: `/admin/*`

---

## API Architecture

### Chat Endpoint (`POST /api/chat`)
The core chat API forwards messages to configured agent webhooks:

**Request Format:**
```json
{
  "input": "message text or array of content blocks",
  "agentId": "optional-agent-uuid",
  "chatId": "optional-existing-chat-uuid"
}
```

**Webhook Payload:**
```json
{
  "session_id": "chat-session-uuid",
  "input": "user message",
  "system_prompt": "optional persona prompt",
  "agent_name": "optional agent name"
}
```

**Key Behaviors:**
- Creates new `session_id` for new chats (persisted across messages)
- Validates user has access to specified `agentId`
- Falls back to `AGENT_WEBHOOK_URL` env var if no agent specified
- Saves messages to database for chat history

### Document Parsing (`POST /api/parse-pdf`)
Supports: PDF, DOCX, XLSX, CSV, images (PNG, JPG, WebP)
- Extracts text content
- For PDFs: generates page thumbnails as data URLs
- Returns structured content for chat input

---

## Security Considerations

### Implemented Security Measures
1. **Security Headers**: Comprehensive CSP, HSTS, X-Frame-Options (see `next.config.ts`)
2. **CSRF Protection**: Custom CSRF token implementation
3. **Rate Limiting**: Built-in rate limiting utilities
4. **Input Sanitization**: `rehype-sanitize` for markdown content
5. **Password Hashing**: bcryptjs with appropriate work factor
6. **JWT Security**: Secure token generation and validation
7. **SQL Injection Prevention**: Parameterized queries via `@neondatabase/serverless`

### Environment Security
- `JWT_SECRET` must be 64+ characters in production
- `DATABASE_URL` should use SSL (`sslmode=require`)
- Never commit `.env.local` to version control

---

## Deployment

### Docker Deployment
The application uses multi-stage Docker build optimized for production:

```dockerfile
# Build stages:
1. base     - Node.js 22 Alpine
2. deps     - Install dependencies (with native packages)
3. builder  - Build Next.js application
4. runner   - Production image with non-root user
```

**Build and Run:**
```bash
docker build -t oto-reach-agents .
docker run -p 3000:3000 --env-file .env oto-reach-agents
```

### Vercel Deployment
- Set environment variables in Vercel dashboard
- Connect Neon PostgreSQL database
- Enable Vercel Analytics (already integrated)

---

## Development Workflow

### Adding New Components
```bash
# Add shadcn/ui component
npx shadcn@latest add button

# Generates: src/components/ui/button.tsx
```

### Database Migrations
Run migrations via the API endpoint:
```bash
# GET request to (after deployment)
GET /api/db/migrate
```

Or execute SQL directly in Neon console (see `src/lib/db/migrations.ts`).

### Adding New API Routes
1. Create folder in `src/app/api/<route>/`
2. Add `route.ts` with exported HTTP method handlers
3. Add `export const runtime = 'edge'` for edge runtime
4. Include proper error handling and content-type headers

---

## Testing Strategy

Currently, the project does not have automated tests configured. When adding tests:

- **Unit Tests**: Jest or Vitest for utilities and hooks
- **Integration Tests**: Playwright or Cypress for E2E flows
- **API Tests**: Test API routes with mock database

Recommended test coverage areas:
- Authentication flows (login, logout, session validation)
- Chat message handling and webhook forwarding
- File parsing for different document types
- Admin CRUD operations

---

## Common Issues and Solutions

### Canvas/Native Dependencies
The application uses `@napi-rs/canvas` for image processing. In Docker:
- Native dependencies installed in `deps` stage
- Libraries: `cairo`, `pango`, `freetype`, `harfbuzz`, etc.

### Edge Runtime Limitations
- No Node.js-specific APIs (fs, path, etc.)
- Use Web-standard APIs (fetch, Request, Response)
- Database via `@neondatabase/serverless` (WebSocket-based)

### Session Management
- Sessions stored in database with expiration
- Token cleanup should be scheduled (not implemented)
- JWT tokens should be refreshed periodically

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Neon Serverless Driver](https://neon.tech/docs/serverless/serverless-driver)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
