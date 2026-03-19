import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { getDb } from "../../lib/db";

/**
 * POST /api/send
 * body: { toId, message, timestamp, type, kind, data, clientMessageId }
 *
 * Serverless-safe:
 * - Persist to Mongo queue with TTL (see /api/poll).
 * - Receiver polls & deletes queue items after receiving.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const username = String(session?.user?.username || "").trim();
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  const { toId, message, timestamp, type, kind, data, clientMessageId } = req.body || {};
  const fromId = username;

  if (!toId || !timestamp) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const t = type || "message";
  if (t === "message") {
    if (typeof message !== "string") return res.status(400).json({ error: "Invalid payload" });
  } else if (t === "typing") {
    // allow empty message
  } else if (t === "invite") {
    if (!data || typeof data !== "object") return res.status(400).json({ error: "Invalid payload" });
    if (typeof data.inviterName !== "string" || typeof data.inviteeName !== "string") {
      return res.status(400).json({ error: "Invalid payload" });
    }
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

  try {
    const db = await getDb();
    const q = db.collection("message_queue");
    await q.insertOne({
      toId: String(toId).trim(),
      fromId,
      payload,
      createdAt: new Date(),
    });
  } catch (e) {
    const msg = String(e?.message || "");
    const name = String(e?.name || "");
    const code = String(e?.code || "");
    console.error("[api/send] error", { name, code, msg });
    return res.status(500).json({ error: "Send failed" });
  }

  return res.status(200).json({ ok: true });
}

