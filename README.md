# OTO Reach Agents

Full-stack AI assistant platform with multi-user chat, configurable agents, personas, and document parsing.

## Requirements

- Node.js 22+
- npm 10+
- Neon PostgreSQL database

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Production build
- `npm run start`: Run production server
- `npm run lint`: ESLint checks
- `npm test`: CI-style gate (`lint` + `build`)
- `npm run format`: Prettier write
- `npm run format:check`: Prettier check

## Security Notes

- Set `JWT_SECRET` to a 64+ character value in production.
- Set `CSRF_SECRET` in production.
- Set `SUPABASE_ENCRYPTION_KEY` in production; credentials are encrypted at rest.
- Excel parsing (`.xls/.xlsx`) is currently disabled due upstream package vulnerabilities. Convert spreadsheets to CSV before upload.
