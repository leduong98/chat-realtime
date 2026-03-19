/**
 * Poll client with auto-retry.
 * - Calls /api/poll?userId=... periodically
 * - No guarantee if server queue expired (TTL)
 */
export function createPollClient({ userId, onMessage, onStatus, intervalMs }) {
  let stopped = false;
  let timer = null;
  let busy = false;
  const baseInterval = typeof intervalMs === "number" ? intervalMs : 1200;
  let backoff = 0;

  function setStatus(status) {
    if (onStatus) onStatus(status);
  }

  async function tick() {
    if (stopped || busy || !userId) return;
    busy = true;
    try {
      setStatus("connected");
      const res = await fetch(`/api/poll?userId=${encodeURIComponent(userId)}`, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error(`poll ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const items = Array.isArray(data?.items) ? data.items : [];
      for (const it of items) {
        if (onMessage) onMessage(it);
      }
      backoff = 0;
    } catch {
      setStatus("disconnected");
      backoff = Math.min(backoff + 1, 6);
    } finally {
      busy = false;
      schedule();
    }
  }

  function schedule() {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    const wait = baseInterval + (backoff ? Math.min(8000, baseInterval * backoff) : 0);
    timer = setTimeout(tick, wait);
  }

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    setStatus("disconnected");
  }

  setStatus("connecting");
  schedule();
  return { stop };
}

