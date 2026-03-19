"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function RequireAuth({ children }) {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="text-sm text-[var(--muted)]">Đang kiểm tra đăng nhập...</div>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="text-sm text-[var(--muted)]">Đang chuyển sang đăng nhập...</div>
      </main>
    );
  }

  return children;
}

