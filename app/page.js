export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="w-full max-w-xl text-center space-y-8">
        <h1 className="text-3xl font-bold text-slate-800">
          P2P WebRTC Chat
        </h1>
        <p className="text-slate-600">
          Kết nối trực tiếp peer-to-peer, không lưu tin nhắn trên server.
        </p>
        <a
          href="/chat"
          className="inline-flex items-center justify-center rounded-2xl bg-[#22c55e] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-green-200/50 hover:bg-[#16a34a] hover:shadow-green-300/50 transition-all"
        >
          Vào phòng chat
        </a>
      </div>
    </main>
  );
}
