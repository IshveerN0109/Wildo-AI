# Cambridge AI Tutor

An AI-powered study platform for Cambridge O Level and A Level students. Features an AI chat tutor (Cambridge syllabus-aware, streaming SSE), smart notes (manual + AI-generated), flashcard sets (manual + AI-generated with flip-card revision mode), and a dashboard with study stats.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `OPENAI_API_KEY` — OpenAI API key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- AI: OpenAI GPT-4o via user's own `OPENAI_API_KEY`

## Where things live

- `lib/db/src/schema/` — DB schema: notes.ts, flashcards.ts, conversations.ts
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for API)
- `artifacts/api-server/src/routes/` — Express route handlers (openai, notes, flashcards, stats)
- `artifacts/cambridge-tutor/src/` — React+Vite frontend
- `lib/integrations-openai-ai-server/src/client.ts` — OpenAI client (falls back to OPENAI_API_KEY)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → React Query hooks in frontend
- SSE streaming for AI chat (raw fetch + ReadableStream, not React Query)
- OpenAI client supports both Replit AI Integrations and bare OPENAI_API_KEY (env var fallback)
- Oxford Blue (`hsl(215, 50%, 23%)`) sidebar + Lora serif headings for academic aesthetic
- All subjects from Cambridge O/A Level syllabus baked into the system prompt

## Product

Cambridge-focused study platform: AI tutor for asking subject questions, note-taking with AI drafting, flashcard revision with flip animations, and a dashboard showing progress across all study tools.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `AI_INTEGRATIONS_OPENAI_BASE_URL` is not set — the OpenAI client falls back to `OPENAI_API_KEY` directly. Do not revert this fallback.
- After schema changes, always run `pnpm --filter @workspace/db run push` before restarting the API.
- After OpenAPI spec changes, run `pnpm --filter @workspace/api-spec run codegen` to regenerate hooks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
