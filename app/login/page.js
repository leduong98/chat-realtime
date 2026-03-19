"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function LoginPage() {
  const { status } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await signIn("credentials", {
        redirect: true,
        callbackUrl: "/chat",
        username,
        password,
      });
      if (res?.error) setErr("Sai username hoặc password.");
    } catch {
      setErr("Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "authenticated") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="text-sm text-[var(--muted)]">Đang chuyển vào chat...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
        <div className="text-lg font-bold text-[var(--fg)]">PI-Chat</div>
        <div className="mt-1 text-sm text-[var(--muted)]">Đăng nhập</div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {err ? <div className="text-sm text-red-600">{err}</div> : null}
          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="w-full h-11 rounded-2xl bg-[var(--primary)] text-white font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {busy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <a
          href="/register"
          className="mt-4 inline-flex text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
        >
          Chưa có tài khoản? Đăng ký
        </a>
      </div>
    </main>
  );
}

