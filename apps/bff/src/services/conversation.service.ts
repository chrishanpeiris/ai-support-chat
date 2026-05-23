import { query, queryOne } from '../db/client';
import type { Conversation, Message } from '../types';

export async function createConversation(userId: string, title?: string): Promise<Conversation> {
  const [conv] = await query<Conversation>(
    `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *`,
    [userId, title ?? null],
  );
  return conv;
}

export async function getConversation(id: string, userId: string): Promise<Conversation | null> {
  return queryOne<Conversation>(
    `SELECT * FROM conversations WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  return query<Conversation>(
    `SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
    [userId],
  );
}

export async function deleteConversation(id: string, userId: string): Promise<void> {
  await query(`DELETE FROM conversations WHERE id = $1 AND user_id = $2`, [id, userId]);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return query<Message>(
    `SELECT
       id,
       conversation_id AS "conversationId",
       role,
       content,
       tool_calls     AS "toolCalls",
       tool_call_id   AS "toolCallId",
       created_at     AS "createdAt"
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId],
  );
}

export async function addMessage(
  conversationId: string,
  role: Message['role'],
  content: string,
  toolCalls?: Message['toolCalls'],
  toolCallId?: string,
): Promise<Message> {
  const [msg] = await query<Message>(
    `INSERT INTO messages (conversation_id, role, content, tool_calls, tool_call_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       conversation_id AS "conversationId",
       role,
       content,
       tool_calls     AS "toolCalls",
       tool_call_id   AS "toolCallId",
       created_at     AS "createdAt"`,
    [conversationId, role, content, toolCalls ? JSON.stringify(toolCalls) : null, toolCallId ?? null],
  );

  await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);

  return msg;
}
