/**
 * Signaling qua HTTP polling (không WebSocket, không Pusher).
 * Dùng GET /api/signal để nhận tin, POST /api/signal để gửi tin.
 */

let userId = null;
let username = null;
let listeners = [];
let pollIntervalId = null;

const POLL_INTERVAL_MS = 600;

function poll() {
  if (typeof window === "undefined" || !userId) return;

  const params = new URLSearchParams({ userId });
  if (username) params.set("username", username);

  fetch(`/api/signal?${params}`)
    .then((res) => res.json())
    .then((data) => {
      const messages = data.messages || [];
      messages.forEach((msg) => {
        listeners.forEach((fn) => fn(msg));
      });
    })
    .catch(() => {});
}

export function connectSignaling(user_id, options = {}) {
  if (typeof window === "undefined") return null;

  userId = user_id;
  username = options.username ?? null;

  if (pollIntervalId) clearInterval(pollIntervalId);
  poll();
  pollIntervalId = setInterval(poll, POLL_INTERVAL_MS);

  return { ready: true };
}

export function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  userId = null;
  username = null;
}

export function onSignalMessage(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((fn) => fn !== callback);
  };
}

export async function sendSignal(message) {
  if (!userId) return;

  try {
    await fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId: userId, ...message }),
    });
  } catch (err) {
    console.error("Failed to send signal", err);
  }
}
