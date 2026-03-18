/**
 * POST /api/send
 * body: { fromId, toId, message, timestamp, type, kind, data, clientMessageId }
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

  const { fromId, toId, message, timestamp, type, kind, data, clientMessageId } = req.body || {};
  if (!fromId || !toId || !timestamp) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const t = type || "message";
  if (t === "message") {
    if (typeof message !== "string") return res.status(400).json({ error: "Invalid payload" });
  } else if (t === "typing") {
    // allow empty message
  } else if (t === "ack") {
    if (!data || typeof data !== "object") return res.status(400).json({ error: "Invalid payload" });
    if (!data.targetMessageId || (data.status !== "delivered" && data.status !== "seen")) {
      return res.status(400).json({ error: "Invalid payload" });
    }
  }

  const id =
    t === "message" && typeof clientMessageId === "string" && clientMessageId.trim()
      ? clientMessageId.trim()
      : crypto.randomUUID();

  const payload = {
    id,
    fromId,
    toId,
    text: typeof message === "string" ? message : "",
    timestamp,
    type: t,
    kind: kind || "text",
    data: data || null,
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

