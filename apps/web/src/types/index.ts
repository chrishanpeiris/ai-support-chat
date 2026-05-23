export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  createdAt: string;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
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
