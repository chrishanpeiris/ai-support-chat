import OpenAI from 'openai';
import type { Response } from 'express';
import { toolDefinitions, executeTool } from './tools.service';
import { addMessage, getMessages } from './conversation.service';
import type { StreamEvent } from '../types';

const client = new OpenAI({
  baseURL: `${process.env.OLLAMA_BASE_URL}/v1`,
  apiKey: 'ollama',
});

const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

const SYSTEM_PROMPT = `You are a helpful customer support assistant for an online tech store.
You have access to tools to look up product information and check order status.
Always use tools when the user asks about specific products or their orders.
Be concise and accurate.`;

function send(res: Response, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function streamChat(
  conversationId: string,
  userMessage: string,
  userId: string,
  res: Response,
): Promise<void> {
  await addMessage(conversationId, 'user', userMessage);

  const dbMessages = await getMessages(conversationId);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...dbMessages.map(mapToOpenAI),
  ];

  // Tool call loop — max 5 rounds to avoid runaway calls
  for (let round = 0; round < 5; round++) {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: toolDefinitions as unknown as OpenAI.Chat.ChatCompletionTool[],
      tool_choice: 'auto',
      stream: true,
    });

    const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>();
    let roundText = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        roundText += delta.content;
        send(res, { type: 'text_delta', content: delta.content });
      }

      for (const tc of delta.tool_calls ?? []) {
        const entry = pendingToolCalls.get(tc.index) ?? { id: '', name: '', arguments: '' };
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name = tc.function.name;
        if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        pendingToolCalls.set(tc.index, entry);
      }
    }

    if (pendingToolCalls.size === 0) {
      await addMessage(conversationId, 'assistant', roundText);
      break;
    }

    const resolvedCalls = Array.from(pendingToolCalls.values()).map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: JSON.parse(tc.arguments || '{}') as Record<string, unknown>,
    }));

    await addMessage(conversationId, 'assistant', roundText, resolvedCalls);

    messages.push({
      role: 'assistant',
      content: roundText || null,
      tool_calls: resolvedCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    });

    for (const tc of resolvedCalls) {
      send(res, { type: 'tool_call', toolCall: tc });

      const result = await executeTool(tc.name, tc.arguments, userId);

      send(res, { type: 'tool_result', toolResult: { toolCallId: tc.id, name: tc.name, result } });

      await addMessage(conversationId, 'tool', JSON.stringify(result), undefined, tc.id);

      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }

  send(res, { type: 'done', conversationId });
}

function mapToOpenAI(
  msg: { role: string; content: string; toolCalls?: unknown; toolCallId?: string },
): OpenAI.Chat.ChatCompletionMessageParam {
  if (msg.role === 'tool') {
    return { role: 'tool', tool_call_id: msg.toolCallId!, content: msg.content };
  }
  if (msg.role === 'assistant' && msg.toolCalls) {
    const tcs = msg.toolCalls as Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    return {
      role: 'assistant',
      content: msg.content || null,
      tool_calls: tcs.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    };
  }
  return { role: msg.role as 'user' | 'assistant', content: msg.content };
}
