# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, generate Prisma client, run migrations
npm run dev          # Start dev server with Turbopack at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all Vitest tests
npx vitest run src/path/to/file.test.ts  # Run a single test file
npm run db:reset     # Reset and re-run all migrations (destructive)
npx prisma migrate dev  # Apply new schema changes and regenerate client
```

**Do not run `npm audit fix`** — dependency versions are pinned intentionally.

## Architecture

UIGen is a Next.js 15 App Router app where users describe React components in a chat and see them rendered live in an iframe.

### Data flow

1. User types in `ChatInterface` → `ChatProvider` (wraps `useChat` from `@ai-sdk/react`) sends messages + serialized VFS state to `POST /api/chat`
2. API route streams back `streamText` responses (via Vercel AI SDK), calling two tools: `str_replace_editor` and `file_manager`
3. `onToolCall` in `ChatProvider` forwards tool calls to `FileSystemProvider.handleToolCall`, which mutates the in-memory `VirtualFileSystem`
4. `PreviewFrame` reacts to `refreshTrigger` (incremented on every VFS mutation), transforms all VFS files through Babel, builds an ES module import map with blob URLs, and writes it to an `<iframe srcdoc>`

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is an in-memory tree with a flat `Map<path, FileNode>` for O(1) lookups. It never writes to disk. The AI always works against `/App.jsx` as the entry point and imports other local files using the `@/` alias (e.g., `@/components/Button`).

State flows:
- **Anonymous users**: VFS state lives only in memory + `sessionStorage` via `anon-work-tracker.ts`
- **Authenticated users**: VFS is serialized to `Project.data` (JSON string) in SQLite on each AI response via `onFinish`

### Preview pipeline

`src/lib/transform/jsx-transformer.ts` runs entirely in the browser:
1. Transforms `.jsx`/`.tsx` files with `@babel/standalone` (React automatic runtime + optional TypeScript)
2. Resolves imports: local files → blob URLs, third-party packages → `https://esm.sh/<pkg>`, missing local files → placeholder stub modules
3. Injects a Tailwind CDN `<script>` and React 19 from `esm.sh` into the iframe HTML

### Authentication

JWT-based, cookie-only (`auth-token`). `src/lib/auth.ts` is server-only. Sessions last 7 days. The `JWT_SECRET` env var defaults to a hardcoded dev string. Anonymous users can use the app without signing in; projects are only persisted for authenticated users.

### AI provider

`src/lib/provider.ts` checks `ANTHROPIC_API_KEY` at runtime. If absent or still the placeholder `your-api-key-here`, it returns `MockLanguageModel` (canned multi-step responses). Otherwise it returns `anthropic("claude-haiku-4-5")` via `@ai-sdk/anthropic`. The model is `claude-haiku-4-5` — change `MODEL` in that file to switch.

### Database

Prisma with SQLite (`prisma/dev.db`). Two models: `User` (email+password) and `Project` (JSON blobs for `messages` and `data`). Prisma client is generated to `src/generated/prisma/` (non-standard output path — import from `@/generated/prisma`, not `@prisma/client`).

### Key conventions

- All file imports within the virtual FS use `@/` as an alias to the root `/`
- The AI system prompt (`src/lib/prompts/generation.tsx`) enforces `/App.jsx` as the required entry point
- `FileSystemProvider` and `ChatProvider` must wrap all components that use `useFileSystem()` / `useChat()` — they are React context providers, not global singletons
- `src/lib/auth.ts` has `"server-only"` at the top — never import it from client components
- Tests use Vitest + jsdom + React Testing Library; test files live in `__tests__/` subdirectories co-located with source

## CI / GitHub Actions context

When running inside GitHub Actions (e.g. triggered by an `@claude` mention on an issue):
- The dev server is already running at `http://localhost:3000` — do not start it again
- Server logs are being written to `logs.txt`
- Use `sqlite3 prisma/dev.db` to query the database if needed
- Use the `mcp__playwright__*` tools to open a browser and interact with the app
