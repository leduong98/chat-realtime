export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-xl text-center space-y-6">
        <h1 className="text-3xl font-bold text-[var(--fg)]">PI-Chat</h1>
        <div className="flex items-center justify-center gap-3">
          <a
            href="/login"
            className="h-11 inline-flex items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
          >
            Đăng nhập
          </a>
          <a
            href="/register"
            className="h-11 inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--card-2)] transition-colors cursor-pointer"
          >
            Đăng ký
          </a>
        </div>
      </div>
    </main>
  );
}
