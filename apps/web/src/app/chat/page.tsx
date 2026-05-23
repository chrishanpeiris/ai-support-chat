import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import ChatWindow from '@/components/chat/ChatWindow';

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold">Support Chat</h1>
        <span className="text-sm text-gray-500">{session.user.email}</span>
      </header>
      <div className="flex-1 overflow-hidden">
        <ChatWindow />
      </div>
    </main>
  );
}
