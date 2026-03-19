export const dynamic = "force-dynamic";

import AppHeader from "../../components/AppHeader";
import ChatWindow from "../../components/ChatWindow";
import RequireAuth from "../../components/RequireAuth";

export default function ChatPage() {
  return (
    <RequireAuth>
      <main className="min-h-screen flex items-center justify-center px-3 py-6 bg-[var(--bg)]">
        <div className="w-[80vw] max-w-6xl rounded-3xl bg-[var(--card)] shadow-xl border border-[var(--border)] overflow-hidden">
          <AppHeader />
          <div className="px-5 pb-5 pt-3 h-[80vh] min-h-[560px] bg-[var(--card-2)]">
            <ChatWindow />
          </div>
        </div>
      </main>
    </RequireAuth>
  );
}
