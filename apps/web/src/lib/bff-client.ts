import type { StreamEvent, Conversation } from '@/types';

const BFF_URL = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3001';

export async function streamChatMessage(
  message: string,
  conversationId: string | null,
  bffToken: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${BFF_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, conversationId }),
  });

  if (!response.ok) throw new Error(`Stream request failed: ${response.status}`);
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        onEvent(JSON.parse(data) as StreamEvent);
      } catch {
        // skip malformed SSE event
      }
    }
  }
}

export async function fetchConversations(bffToken: string): Promise<Conversation[]> {
  const res = await fetch(`${BFF_URL}/api/conversations`, {
    headers: { Authorization: `Bearer ${bffToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json() as Promise<Conversation[]>;
}

export async function deleteConversation(id: string, bffToken: string): Promise<void> {
  await fetch(`${BFF_URL}/api/conversations/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${bffToken}` },
  });
}
