/**
 * SSE client with auto-reconnect.
 * Server closes connection after ~25s, client reconnects after 1s.
 */

export function createSseClient({ userId, onMessage, onStatus }) {
  let es = null;
  let stopped = false;
  let reconnectTimer = null;

  function setStatus(status) {
    if (onStatus) onStatus(status);
  }

  function connect() {
    if (stopped) return;
    if (!userId) return;

    try {
      setStatus("connecting");
      es = new EventSource(`/api/stream?userId=${encodeURIComponent(userId)}`);

      es.onopen = () => {
        setStatus("connected");
      };

      es.onmessage = (event) => {
        if (!event?.data) return;
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data);
        } catch {
          // ignore
        }
      };

      // Browsers often fire onerror when server closes the SSE stream.
      es.onerror = () => {
        try {
          es.close();
        } catch {
          // ignore
        }
        es = null;
        setStatus("disconnected");
        if (!stopped) {
          reconnectTimer = setTimeout(connect, 1000);
        }
      };
    } catch {
      setStatus("disconnected");
      reconnectTimer = setTimeout(connect, 1000);
    }
  }

  function stop() {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (es) {
      try {
        es.close();
      } catch {
        // ignore
      }
      es = null;
    }
    setStatus("disconnected");
  }

  connect();
  return { stop };
}

