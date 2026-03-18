export const dynamic = "force-dynamic";

import ChatWindow from "../../components/ChatWindow";

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-[#f1f5f9] flex items-center justify-center px-3 py-6">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">SSE 1-1 Chat</h1>
            <p className="text-xs text-slate-500">
              HTTP POST gửi tin nhắn • SSE nhận tin nhắn
            </p>
          </div>
        </div>
        <div className="px-5 pb-5 pt-3 h-[560px] bg-[#fafafa]">
          <ChatWindow />
        </div>
      </div>
    </main>
  );
}
