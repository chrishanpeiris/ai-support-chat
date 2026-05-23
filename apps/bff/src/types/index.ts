export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type StreamEventType = 'text_delta' | 'tool_call' | 'tool_result' | 'done' | 'error';

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  toolCall?: ToolCall;
  toolResult?: {
    toolCallId: string;
    name: string;
    result: unknown;
  };
  conversationId?: string;
  error?: string;
}
