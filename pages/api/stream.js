/**
 * SSE stream endpoint.
 * - Holds connection max ~25s, then closes (client should reconnect).
 * - Does NOT store messages.
 * - Only delivers messages to connections that are open right now.
 *
 * NOTE: On serverless (Vercel), in-memory connections are best-effort only.
 */

// userId -> Set<ServerResponse>
const activeStreams = globalThis.__activeSseStreams || new Map();
globalThis.__activeSseStreams = activeStreams;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const userId = req.query.userId;
  if (!userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  // Initial comment to establish stream
  res.write(`: connected\n\n`);

  if (!activeStreams.has(userId)) {
    activeStreams.set(userId, new Set());
  }
  activeStreams.get(userId).add(res);

  const timeout = setTimeout(() => {
    try {
      res.end();
    } catch {
      // ignore
    }
  }, 25000);

  const cleanup = () => {
    clearTimeout(timeout);
    const set = activeStreams.get(userId);
    if (set) {
      set.delete(res);
      if (set.size === 0) activeStreams.delete(userId);
    }
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
}

