"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getInitialTheme, saveTheme } from "../lib/theme";

export default function AppHeader() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }

  return (
    <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--card)] flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-[var(--fg)]">PI-Chat</h1>
        <button
          type="button"
          className="p-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--fg)] hover:bg-[var(--card)] transition-colors cursor-pointer"
          onClick={toggleTheme}
          title="Đổi giao diện sáng/tối"
        >
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

