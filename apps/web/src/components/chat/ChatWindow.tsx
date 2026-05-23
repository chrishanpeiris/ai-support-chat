'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { streamChatMessage } from '@/lib/bff-client';
import type { Message, StreamEvent } from '@/types';

export default function ChatWindow() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (isStreaming || !session?.bffToken) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: conversationId ?? '',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: conversationId ?? '',
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const onEvent = (event: StreamEvent) => {
      switch (event.type) {
        case 'text_delta':
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: m.content + (event.content ?? '') } : m,
            ),
          );
          break;

        case 'tool_call':
          if (!event.toolCall) break;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), { ...event.toolCall!, result: undefined }] }
                : m,
            ),
          );
          break;

        case 'tool_result':
          if (!event.toolResult) break;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    toolCalls: m.toolCalls?.map((tc) =>
                      tc.id === event.toolResult!.toolCallId
                        ? { ...tc, result: event.toolResult!.result }
                        : tc,
                    ),
                  }
                : m,
            ),
          );
          break;

        case 'done':
          if (event.conversationId && !conversationId) setConversationId(event.conversationId);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)),
          );
          break;

        case 'error':
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: 'Something went wrong. Please try again.', isStreaming: false }
                : m,
            ),
          );
          break;
      }
    };

    try {
      await streamChatMessage(text, conversationId, session.bffToken, onEvent);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: 'Connection error. Please try again.', isStreaming: false }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-24 select-none">
            <p className="text-lg font-medium">How can I help you today?</p>
            <p className="text-sm mt-1">Try: "What laptops do you have?" or "Show my orders"</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-4 shrink-0">
        <MessageInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
