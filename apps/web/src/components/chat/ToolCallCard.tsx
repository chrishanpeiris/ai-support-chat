import type { ToolCall } from '@/types';

const labels: Record<string, string> = {
  get_product_info: 'Looking up products',
  get_order_status: 'Checking orders',
};

export default function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const label = labels[toolCall.name] ?? toolCall.name;
  const done = toolCall.result !== undefined;

  return (
    <div className="mb-2 border border-gray-200 rounded-lg p-2 bg-white text-sm">
      <div className="flex items-center gap-2 text-gray-500">
        <span>{done ? '✓' : '⟳'}</span>
        <span className={done ? 'line-through text-gray-400' : ''}>{label}</span>
      </div>
      {done && toolCall.result != null && (
        <details className="mt-1">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">View result</summary>
          <pre className="mt-1 text-xs text-gray-600 overflow-auto max-h-40">
            {JSON.stringify(toolCall.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
