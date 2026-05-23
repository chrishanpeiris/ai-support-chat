'use client';

import { useState, type KeyboardEvent } from 'react';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask about products or your orders… (Enter to send)"
        rows={1}
        className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3
                   focus:outline-none focus:ring-2 focus:ring-blue-500
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="rounded-xl bg-blue-600 px-5 py-3 text-white font-medium
                   hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors shrink-0"
      >
        Send
      </button>
    </div>
  );
}
