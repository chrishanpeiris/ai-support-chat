# AI Support Chat — Testing Guide

**Current state:** no test runner is configured yet. This guide explains what to add and how to write tests that match this project's architecture (BFF + SSE streaming + LLM tool use).

---

## Recommended stack

| Layer | Tool | Why |
|---|---|---|
| BFF (Node/Express) | Jest + Supertest | Same pattern as task-management; tests real HTTP routes |
| Web (Next.js) | Vitest + RTL | Lighter than Jest for Vite-adjacent Next.js apps |
| Streaming (SSE) | Jest + custom helpers | Need to collect chunks from a stream |

---

## Step 1 — Add testing to the BFF

```bash
cd apps/bff
npm install -D jest @types/jest ts-jest supertest @types/supertest
```

Create `apps/bff/jest.config.js`:
```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

Add to `apps/bff/package.json`:
```json
"scripts": {
  "test": "jest --passWithNoTests --forceExit",
  "test:watch": "jest --watch"
}
```

---

## Step 2 — Add testing to the web app

```bash
cd apps/web
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
});
```

Create `apps/web/src/__tests__/setup.ts`:
```ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

vi.mock('next/navigation', () => ({
  useRouter:       vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  usePathname:     vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
```

---

## Pattern 1 — Testing a BFF route

```ts
// apps/bff/src/__tests__/auth.test.ts
import request from 'supertest';
import { app } from '../index';

describe('POST /api/auth/login', () => {
  it('returns 401 for wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'bad' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns a token for valid credentials', async () => {
    // Seed a user first, or use the demo account
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
```

---

## Pattern 2 — Testing SSE streaming (the key challenge)

The `/api/chat` route sends Server-Sent Events — chunks of text over a long-lived HTTP connection. Testing this requires collecting the stream manually.

```ts
// apps/bff/src/__tests__/chat.test.ts
import request from 'supertest';
import { app } from '../index';

// Helper: collect all SSE chunks into an array of strings
async function collectSSE(
  req: request.Test,
  timeoutMs = 5000,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const timer = setTimeout(() => resolve(chunks), timeoutMs);

    req
      .buffer(false)
      .parse((res, callback) => {
        res.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          // SSE lines look like:  data: {"type":"chunk","content":"Hello"}
          text.split('\n').forEach((line) => {
            if (line.startsWith('data: ')) {
              chunks.push(line.slice(6));
            }
          });
        });
        res.on('end', () => {
          clearTimeout(timer);
          callback(null, '');
          resolve(chunks);
        });
        res.on('error', (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      })
      .end();
  });
}

describe('POST /api/chat (SSE stream)', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@example.com', password: 'password123' });
    token = res.body.token;
  });

  it('streams at least one chunk for a valid message', async () => {
    const req = request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'text/event-stream')
      .send({ message: 'Hello' });

    const chunks = await collectSSE(req);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when message is missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
```

---

## Pattern 3 — Mocking the LLM (Anthropic API)

Real LLM calls are slow and cost money. Mock the Anthropic client in unit tests:

```ts
// apps/bff/src/__tests__/llm.test.ts
import { buildSystemPrompt, parseToolCall } from '../lib/llm';

// Mock the Anthropic SDK so no real API calls are made
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        stop_reason: 'end_turn',
      }),
    },
  })),
}));

describe('buildSystemPrompt', () => {
  it('includes the company name in the prompt', () => {
    const prompt = buildSystemPrompt({ companyName: 'Acme Corp' });
    expect(prompt).toContain('Acme Corp');
  });
});

describe('parseToolCall', () => {
  it('extracts tool name and input from a tool_use block', () => {
    const block = {
      type: 'tool_use',
      name: 'search_knowledge_base',
      input: { query: 'refund policy' },
    };
    const result = parseToolCall(block);
    expect(result.name).toBe('search_knowledge_base');
    expect(result.input.query).toBe('refund policy');
  });
});
```

---

## Pattern 4 — Testing a React component (web app)

```tsx
// apps/web/src/__tests__/components/ChatMessage.test.tsx
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '@/components/ChatMessage';

describe('ChatMessage', () => {
  it('renders the message text', () => {
    render(<ChatMessage role="assistant" content="Hello! How can I help?" />);
    expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
  });

  it('applies different styles for user vs assistant', () => {
    const { rerender } = render(
      <ChatMessage role="user" content="My question" />,
    );
    const userMsg = screen.getByText('My question').closest('div');
    expect(userMsg).toHaveClass('bg-blue-600'); // user bubble is blue

    rerender(<ChatMessage role="assistant" content="My answer" />);
    const assistantMsg = screen.getByText('My answer').closest('div');
    expect(assistantMsg).toHaveClass('bg-gray-100'); // assistant bubble is grey
  });

  it('shows a typing indicator when isStreaming is true', () => {
    render(<ChatMessage role="assistant" content="" isStreaming />);
    expect(screen.getByRole('status', { name: /typing/i })).toBeInTheDocument();
  });
});
```

---

## Pattern 5 — Testing the custom SSE hook

```tsx
// apps/web/src/__tests__/hooks/useChat.test.ts
import { renderHook, act } from '@testing-library/react';
import { useChat } from '@/hooks/useChat';

// Mock fetch to simulate an SSE stream
const mockSSEResponse = (chunks: string[]) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      });
      controller.close();
    },
  });
  return Promise.resolve(new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  }));
};

global.fetch = vi.fn();

describe('useChat', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(() =>
      mockSSEResponse([
        JSON.stringify({ type: 'chunk', content: 'Hello' }),
        JSON.stringify({ type: 'chunk', content: ' world' }),
        JSON.stringify({ type: 'done' }),
      ]),
    );
  });

  it('accumulates streamed chunks into the message', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    const lastMessage = result.current.messages.at(-1);
    expect(lastMessage?.content).toBe('Hello world');
    expect(lastMessage?.role).toBe('assistant');
  });

  it('sets isStreaming to true while the stream is active', async () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.isStreaming).toBe(false);

    act(() => { result.current.sendMessage('Hi'); });
    expect(result.current.isStreaming).toBe(true);
  });
});
```

---

## What to test first

Since this project has no tests yet, add them in this order (highest value first):

1. **Auth routes** — login success/failure, token validation (low complexity, high importance)
2. **Chat route validation** — missing message, missing auth (no LLM call needed, mock it)
3. **Utility functions** — `buildSystemPrompt`, message formatting (pure functions, easiest)
4. **SSE stream** — at least verify a response is sent for valid input
5. **React components** — `ChatMessage`, the input form, message list

---

## Running tests once added

```bash
# BFF
cd apps/bff && npm test

# Web
cd apps/web && npm test

# Both from root
npm test
```
