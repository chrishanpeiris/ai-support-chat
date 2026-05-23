import type { Message } from '@/types';
import ToolCallCard from './ToolCallCard';

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        }`}
      >
        {message.toolCalls?.map((tc) => <ToolCallCard key={tc.id} toolCall={tc} />)}
        <p className="whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse rounded-sm" />
          )}
        </p>
      </div>
    </div>
  );
}
