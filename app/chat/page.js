export const dynamic = "force-dynamic";

import AppHeader from "../../components/AppHeader";
import ChatWindow from "../../components/ChatWindow";
import RequireAuth from "../../components/RequireAuth";

export default function ChatPage() {
  return (
    <RequireAuth>
      <main className="h-screen min-h-0 flex flex-col overflow-hidden md:flex md:justify-center md:items-center md:px-3 md:py-6 px-0 py-0 bg-[var(--bg)]">
        <div className="flex-1 flex flex-col min-h-0 w-full md:flex-none md:w-[80vw] md:max-w-6xl md:h-[calc(100vh-3rem)] md:rounded-3xl md:bg-[var(--card)] md:shadow-xl md:border md:border-[var(--border)] md:overflow-hidden overflow-hidden">
          <header className="hidden md:block shrink-0">
            <AppHeader />
          </header>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-2 pb-2 pt-2 md:px-5 md:pb-5 md:pt-3 bg-[var(--card-2)]">
            <ChatWindow />
          </div>
        </div>
      </main>
    </RequireAuth>
  );
}
