# AI Support Chat

A full-stack AI-powered customer support chat application demonstrating:

- **LLM streaming + tool use** via Ollama (local, zero cost)
- **BFF pattern** — Next.js frontend + separate Node.js/Express backend-for-frontend
- **Auth** — NextAuth.js credentials provider with JWT forwarded to BFF
- **PostgreSQL** — conversations, messages, products, orders
- **Docker + docker-compose** — entire stack in one command
- **GitHub Actions CI** — typecheck → lint → build Docker images → push to GHCR

## Architecture

➡ **[Interactive architecture diagram](docs/architecture.html)** — open in a browser, download as PNG.

```
Browser (Next.js)
   │  credentials login
   ▼
NextAuth.js ──── signs a BFF JWT ───► stored in session
   │
   │  POST /api/chat/stream (Bearer <bff-jwt>)
   ▼
BFF (Express)
   ├── auth middleware  → jwtVerify with shared NEXTAUTH_SECRET
   ├── conversation service → PostgreSQL
   ├── LLM service
   │     ├── calls Ollama /v1/chat/completions (streaming)
   │     ├── tool call loop (max 5 rounds)
   │     └── streams SSE events back to browser
   └── tools service
         ├── get_product_info  → SELECT from products
         └── get_order_status  → SELECT from orders JOIN products
```

## Quick start (Docker)

```bash
# 1. Start the stack
make up

# 2. Pull the Ollama model (one-time, ~2 GB)
make pull-model

# 3. Open http://localhost:3000
# Login: demo@example.com / demo1234
```

## Quick start (local dev — no Docker for app code)

```bash
# Requires: Node 20+, PostgreSQL running, Ollama running locally

cp apps/bff/.env.example apps/bff/.env
cp apps/web/.env.example apps/web/.env

npm install        # installs all workspaces
npm run dev        # starts BFF on :3001 and web on :3000
```

Run Ollama separately:
```bash
ollama serve
ollama pull llama3.2
```

## Project structure

```
apps/
  bff/                      Node.js + Express BFF
    src/
      db/                   PostgreSQL client, migrations, seed
      middleware/auth.ts    JWT validation
      routes/               auth, chat (SSE), conversations
      services/
        llm.service.ts      Ollama streaming + tool call loop
        tools.service.ts    Tool definitions + DB execution
        conversation.service.ts
  web/                      Next.js 14 (App Router)
    src/
      app/                  Pages and route handlers
      components/chat/      ChatWindow, MessageBubble, ToolCallCard, MessageInput
      lib/
        auth.ts             NextAuth config + BFF JWT signing
        bff-client.ts       SSE stream reader + fetch helpers
      types/                Shared TypeScript types
```

## CI/CD

Every push runs:
1. **Typecheck** — `tsc --noEmit` across both apps
2. **Lint** — `next lint` (web) + tsc (bff)
3. **Build + push** — Docker images built with layer caching, pushed to GHCR on `main`

See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Key design decisions

| Decision | Why |
|---|---|
| BFF as a separate Express process, not Next.js API routes | Demonstrates the BFF pattern; scales independently; clean auth boundary |
| Ollama instead of cloud API | Zero cost; same API as OpenAI; shows ability to run self-hosted models |
| SSE over WebSocket | Simpler for unidirectional streaming; no library needed on either side |
| Tool call loop (max 5 rounds) | Prevents runaway calls while allowing multi-step reasoning |
| JWT signed with shared NEXTAUTH_SECRET | BFF validates tokens without a round-trip to Next.js; standard practice |
| Raw `pg` in BFF | Explicit SQL shows relational data skills; Prisma used in Project 2 for migrations showcase |
