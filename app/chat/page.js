export const dynamic = "force-dynamic";

import ChatWindow from "../../components/ChatWindow";

export default function ChatPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-3 py-6 bg-[var(--bg)]">
      <div className="w-[80vw] max-w-6xl rounded-3xl bg-[var(--card)] shadow-xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--card)] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--fg)]">PI-Chat</h1>
          </div>
        </div>
        <div className="px-5 pb-5 pt-3 h-[80vh] min-h-[560px] bg-[var(--card-2)]">
          <ChatWindow />
        </div>
      </div>
    </main>
  );
}
