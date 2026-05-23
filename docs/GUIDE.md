# AI Support Chat — Developer Guide

> Next.js BFF · Ollama LLM streaming · Tool use · PostgreSQL · Server-Sent Events  
> Reference this when adding features, debugging, or preparing for interviews.

---

## Table of contents

1. [How the system is wired](#1-how-the-system-is-wired)
2. [Project structure](#2-project-structure)
3. [Request flows end-to-end](#3-request-flows-end-to-end)
4. [Key files and what they own](#4-key-files-and-what-they-own)
5. [How to add a feature](#5-how-to-add-a-feature)
6. [The BFF pattern explained](#6-the-bff-pattern)
7. [LLM tool use explained](#7-llm-tool-use)
8. [Running locally](#8-running-locally)
9. [Interview playbook](#9-interview-playbook)

---

## 1. How the system is wired

```
Browser
  │
  ▼
Next.js BFF :3000
  ├── /api/auth/*        ← login, register, JWT
  ├── /api/chat/stream   ← SSE stream to browser
  │       │
  │       ▼
  │   Ollama :11434      ← local LLM (llama3 / mistral)
  │       │
  │       └── tool calls ──► tools.service.ts (order lookup, ticket create)
  │
  └── /api/conversations ← load/list conversation history
          │
          ▼
      PostgreSQL         ← users, conversations, messages
```

**The BFF pattern:** the browser never talks to Ollama or PostgreSQL directly.
All AI logic, secrets, and data access live in the BFF (Next.js API routes / Express backend).

---

## 2. Project structure

```
ai-support-chat/
├── apps/
│   ├── bff/                              ← Backend For Frontend (Express)
│   │   └── src/
│   │       ├── index.ts                  ← Express app + route registration
│   │       ├── middleware/auth.ts        ← JWT validation middleware
│   │       ├── db/
│   │       │   ├── client.ts             ← PostgreSQL connection (pg Pool)
│   │       │   └── migrate.ts            ← SQL migration runner
│   │       ├── routes/
│   │       │   ├── auth.ts               ← POST /auth/login, /auth/register
│   │       │   ├── chat.ts               ← POST /chat/stream (SSE)
│   │       │   └── conversations.ts      ← GET /conversations, GET /conversations/:id
│   │       ├── services/
│   │       │   ├── llm.service.ts        ← Ollama API calls + streaming logic
│   │       │   ├── conversation.service.ts ← save/load messages from PostgreSQL
│   │       │   └── tools.service.ts      ← LLM tool implementations
│   │       └── types/index.ts            ← shared BFF types
│   │
│   └── web/                              ← Next.js 14 frontend
│       └── src/
│           ├── app/
│           │   ├── (auth)/login/page.tsx ← login form
│           │   ├── chat/page.tsx         ← main chat UI
│           │   ├── layout.tsx            ← root layout
│           │   └── providers.tsx         ← React context providers
│           ├── components/chat/
│           │   ├── ChatWindow.tsx        ← message list + scroll
│           │   ├── MessageBubble.tsx     ← user vs assistant styling
│           │   ├── MessageInput.tsx      ← textarea + send button
│           │   └── ToolCallCard.tsx      ← shows tool invocations in-chat
│           ├── lib/
│           │   ├── auth.ts               ← token storage + auth helpers
│           │   └── bff-client.ts         ← fetch wrappers for BFF API
│           └── types/index.ts            ← frontend types
│
├── docker-compose.yml                    ← PostgreSQL
└── package.json                          ← npm workspaces root
```

---

## 3. Request flows end-to-end

### Login
```
POST /api/auth/login  { email, password }
  1. BFF: query PostgreSQL for user by email
  2. bcrypt.compare(password, user.password_hash)
  3. Sign JWT: { sub: userId, email }
  4. Return { token }
  5. Browser: stores token, redirects to /chat
```

### Send a message (streaming)
```
POST /api/chat/stream  { message, conversationId? }
  + Authorization: Bearer <jwt>

  1. BFF auth middleware: verify JWT, set req.user
  2. conversation.service: load previous messages from PostgreSQL
  3. Build messages array: [system, ...history, { role: 'user', content: message }]
  4. llm.service: POST to Ollama /api/chat with stream: true
  5. BFF sets headers: Content-Type: text/event-stream
  6. For each chunk from Ollama:
       a. If text chunk → write SSE: data: {"type":"text","content":"..."}
       b. If tool_call → execute tool → write SSE: data: {"type":"tool","name":"...","result":...}
  7. On finish:
       - conversation.service: save user message + full assistant response to PostgreSQL
       - write SSE: data: {"type":"done"}
       - close stream
```

### Tool execution (mid-stream)
```
Ollama returns: { tool_calls: [{ function: { name: "lookup_order", arguments: {...} } }] }

  1. llm.service detects tool_call in chunk
  2. Calls tools.service.executeTool(name, args)
  3. tools.service runs the tool (DB query, mock API, etc.)
  4. Result is sent back to Ollama as a tool message
  5. Ollama continues generating text response
  6. Browser receives tool result as SSE event → renders ToolCallCard
```

### Load conversation history
```
GET /api/conversations/:id
  1. Auth middleware validates JWT
  2. conversation.service queries PostgreSQL:
     SELECT * FROM messages WHERE conversation_id = ? AND user_id = ?
     ORDER BY created_at ASC
  3. Returns { messages: [...] }
  4. ChatWindow renders history
```

---

## 4. Key files and what they own

| File | Responsibility |
|---|---|
| `bff/src/routes/chat.ts` | SSE stream setup, orchestrates LLM + tools + DB |
| `bff/src/services/llm.service.ts` | All Ollama communication, streaming, tool call detection |
| `bff/src/services/tools.service.ts` | Tool definitions + implementations (order lookup, ticket creation) |
| `bff/src/services/conversation.service.ts` | Save/load messages from PostgreSQL |
| `bff/src/middleware/auth.ts` | JWT validation — protects all non-auth routes |
| `bff/src/db/client.ts` | PostgreSQL pool — used by all services |
| `web/src/lib/bff-client.ts` | All fetch calls to BFF + SSE reader |
| `web/src/components/chat/ChatWindow.tsx` | Message list, handles streaming token-by-token |
| `web/src/components/chat/ToolCallCard.tsx` | Visual card shown when LLM uses a tool |

---

## 5. How to add a feature

### Pattern: add a new LLM tool

Example: add a `check_return_policy` tool.

```
Step 1 — Define the tool (bff/src/services/tools.service.ts)

  Add to tools array (sent to Ollama so it knows what's available):
  {
    type: 'function',
    function: {
      name: 'check_return_policy',
      description: 'Check the return policy for a product category',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Product category name' }
        },
        required: ['category']
      }
    }
  }

  Add to executeTool() switch:
  case 'check_return_policy': {
    const { category } = args as { category: string }
    // Query DB or return static policy
    return { policy: '30 days', category, conditions: 'Unused, original packaging' }
  }

Step 2 — No other backend changes needed.
  llm.service already handles any tool call generically.

Step 3 — Frontend (optional — tool results already show in ToolCallCard)
  Customize ToolCallCard.tsx if you want a special display for this tool.
```

---

### Pattern: add a new API endpoint to the BFF

Example: add `GET /api/conversations` to list all user conversations.

```
Step 1 — Route (bff/src/routes/conversations.ts)
  router.get('/', authenticate, async (req, res) => {
    const { rows } = await db.query(
      `SELECT id, title, created_at FROM conversations
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    )
    res.json({ conversations: rows })
  })

Step 2 — Register route (bff/src/index.ts)
  app.use('/api/conversations', conversationsRouter)  // already done

Step 3 — Frontend (web/src/lib/bff-client.ts)
  export async function listConversations() {
    const res = await fetch('/api/conversations', { headers: authHeaders() })
    if (!res.ok) throw new Error('Failed to load conversations')
    return res.json()
  }

Step 4 — UI — call listConversations() and render a sidebar
```

---

### Pattern: add a system prompt variation

The system prompt tells the LLM how to behave. It lives in `llm.service.ts`.

```typescript
const SYSTEM_PROMPT = `You are a helpful customer support agent for AcmeCorp.
You have access to tools to look up orders and create support tickets.
Always be polite and professional.
If you cannot help, offer to escalate to a human agent.`
```

To add a different persona (e.g. a technical support agent):
```typescript
const TECH_SUPPORT_PROMPT = `You are a technical support specialist.
Focus on troubleshooting steps. Ask clarifying questions before suggesting solutions.`

// In llm.service, accept persona as parameter:
export async function streamResponse(messages, persona = 'general') {
  const systemPrompt = persona === 'tech' ? TECH_SUPPORT_PROMPT : SYSTEM_PROMPT
  ...
}
```

---

## 6. The BFF pattern

**BFF = Backend For Frontend.** The Next.js app has a dedicated backend that exists solely to serve that specific frontend.

**Why not call Ollama from the browser directly?**

| Problem | BFF solution |
|---|---|
| API keys / Ollama URL exposed | Stays in BFF environment, browser never sees it |
| CORS — Ollama doesn't allow browser origins | BFF proxies the request |
| No auth layer in Ollama | BFF validates JWT before forwarding |
| Message history needs a DB | BFF owns PostgreSQL — browser has no DB access |
| Tool execution needs server-side DB/API access | BFF runs tools, returns only the result |

**The contract:** browser sends `{ message, conversationId }` → BFF handles all the complexity → browser receives a stream of tokens.

---

## 7. LLM tool use

Tool use (function calling) lets the LLM decide when to call external functions.

**Flow:**
```
1. BFF sends to Ollama:
   {
     messages: [...],
     tools: [{ name: 'lookup_order', description: '...', parameters: {...} }]
   }

2. Ollama streams back text OR a tool_call:
   { tool_calls: [{ function: { name: 'lookup_order', arguments: { orderId: '123' } } }] }

3. BFF executes the tool:
   const result = await tools.executeTool('lookup_order', { orderId: '123' })

4. BFF sends the tool result back to Ollama:
   { role: 'tool', content: JSON.stringify(result) }

5. Ollama generates the final response using the tool result.

6. BFF streams the final response to the browser.
```

**The LLM chooses** when to use tools. The system prompt guides it, but the model decides.
You can influence this with prompt engineering (e.g. "Always look up order details before answering questions about orders").

**Adding a tool** = adding an entry to the tools array AND adding a case to `executeTool()`. No changes to the streaming infrastructure.

---

## 8. Running locally

**Prerequisites:** Node 20, Docker, [Ollama](https://ollama.ai) installed.

```bash
# Pull a model (first time only — large download)
ollama pull llama3

# Start PostgreSQL
docker compose up postgres -d

# Install dependencies
npm install

# Run database migrations
npm run migrate -w apps/bff

# Start both services
npm run dev

# Open http://localhost:3000
```

**Ports:**
| Port | Service |
|---|---|
| 3000 | Next.js web |
| 3001 | BFF (Express) |
| 5432 | PostgreSQL |
| 11434 | Ollama |

---

## 9. Interview playbook

### Walk me through the architecture

> "It's a BFF (Backend For Frontend) pattern. The browser talks only to our Express backend. The backend handles auth, streams LLM responses via Server-Sent Events, and executes tool calls. The LLM (Ollama running locally) never gets a direct browser connection — all API keys and tool logic stay server-side. Conversation history is persisted in PostgreSQL so users can resume sessions."

### What are Server-Sent Events and why not WebSockets?

> "SSE is a one-directional stream from server to browser over HTTP. The browser sends one POST request and receives a stream of events until the LLM finishes. WebSockets are bidirectional — useful for chat apps where both sides send messages simultaneously. Here, once the user sends a message, only the server sends back data, so SSE is simpler. It works over standard HTTP, no upgrade handshake, and reconnects automatically."

### How does LLM tool use work?

> "The model is given a list of available tools with JSON Schema descriptions. When the model decides it needs external data — like looking up an order — it emits a `tool_calls` chunk instead of text. The BFF intercepts that, runs the tool against our database, sends the result back to the model as a tool message, and the model continues generating its response. The user sees a tool call card in the UI showing what the model did."

### Why store conversation history in PostgreSQL?

> "Without persistence, every message would start a new context — the LLM wouldn't remember what was said earlier in the conversation. We save each message with its role (user/assistant/tool) and load the full history on each request. PostgreSQL gives us reliable storage with user-scoped access control. An alternative would be Redis for active sessions with PostgreSQL for long-term archive."

### What would you change at scale?

> "Three things: replace Ollama with a cloud LLM API (Anthropic/OpenAI) for reliability and scale. Add a message queue (BullMQ) so long conversations don't block the HTTP process. And implement streaming cancellation — right now if the user navigates away, the stream continues until the model finishes."
