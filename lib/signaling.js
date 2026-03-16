// HTTP Long-Polling signaling (works on Vercel)

let userId = null;
let listeners = [];
let pollingInterval = null;
let isPolling = false;

export function connectSignaling(user_id, options = {}) {
  if (typeof window === "undefined") return null;

  userId = user_id;

  // Register username on server
  if (options && options.username != null) {
    fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        type: "register",
        username: options.username,
      }),
    }).catch(() => {
      // ignore
    });
  }

  // Start polling for messages
  if (!isPolling) {
    isPolling = true;
    startPolling();
  }

  return { ready: true };
}

function startPolling() {
  if (pollingInterval) return;

  pollingInterval = setInterval(async () => {
    if (!userId) return;

    try {
      const res = await fetch(`/api/signal?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;

      const messages = await res.json();
      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          listeners.forEach((fn) => fn(msg));
        });
      }
    } catch {
      // ignore polling errors
    }
  }, 800); // Poll every 800ms
}

export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    isPolling = false;
  }
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
      body: JSON.stringify({ userId, ...message }),
    });
  } catch {
    // ignore send errors
  }
}

