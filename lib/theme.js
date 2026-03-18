const KEY = "sse-chat-theme";

export function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved;
  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function saveTheme(theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, theme);
}

