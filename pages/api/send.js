/**
 * POST /api/send
 * body: { fromId, toId, message, timestamp, type }
 *
 * - No DB, no persistence.
 * - Broadcast only if receiver currently has an open SSE stream.
 * - If not, message is lost (by design).
 */

const activeStreams = globalThis.__activeSseStreams || new Map();
globalThis.__activeSseStreams = activeStreams;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fromId, toId, message, timestamp, type } = req.body || {};
  if (!fromId || !toId || typeof message !== "string" || !timestamp) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const payload = {
    id: crypto.randomUUID(),
    fromId,
    toId,
    text: message,
    timestamp,
    type: type || "message",
  };

  const targets = activeStreams.get(toId);
  if (targets && targets.size > 0) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const streamRes of targets) {
      try {
        streamRes.write(data);
      } catch {
        // ignore broken stream
      }
    }
  }

  return res.status(200).json({ ok: true });
}

