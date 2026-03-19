export const dynamic = "force-dynamic";

import AppHeader from "../../components/AppHeader";
import ChatWindow from "../../components/ChatWindow";
import RequireAuth from "../../components/RequireAuth";

export default function ChatPage() {
  return (
    <RequireAuth>
      <main className="min-h-screen flex flex-col md:min-h-screen md:items-center md:justify-center md:px-3 md:py-6 px-0 py-0 bg-[var(--bg)]">
        <div className="flex-1 flex flex-col min-h-0 w-full md:w-[80vw] md:max-w-6xl md:rounded-3xl md:bg-[var(--card)] md:shadow-xl md:border md:border-[var(--border)] overflow-hidden">
          <header className="hidden md:block">
            <AppHeader />
          </header>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-2 pb-2 pt-2 md:px-5 md:pb-5 md:pt-3 md:h-[80vh] md:min-h-[560px] md:max-h-[80vh] bg-[var(--card-2)]">
            <ChatWindow />
          </div>
        </div>
      </main>
    </RequireAuth>
  );
}
