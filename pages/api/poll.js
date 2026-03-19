import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { getDb } from "../../lib/db";

const TTL_SECONDS = 60 * 60 * 24; // 1 day
const MAX_BATCH = 50;
const LONGPOLL_TIMEOUT_MS = 25000;
const CHECK_INTERVAL_MS = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  const username = String(session?.user?.username || "").trim();
  if (!username) return res.status(401).json({ error: "Unauthorized" });

  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  if (userId !== username) return res.status(403).json({ error: "Forbidden" });

  try {
    const db = await getDb();
    const q = db.collection("message_queue");
    await q.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
    await q.createIndex({ ackExpireAt: 1 }, { expireAfterSeconds: 0 });
    await q.createIndex({ toId: 1, createdAt: 1 });

    const started = Date.now();
    let docs = [];

    while (Date.now() - started < LONGPOLL_TIMEOUT_MS) {
      docs = await q
        .find({
          toId: userId,
          $or: [{ requiresAck: { $ne: true } }, { requiresAck: true, deliveredAt: null }],
        })
        .sort({ createdAt: 1 })
        .limit(MAX_BATCH)
        .toArray();
      if (docs.length) break;
      // wait before checking again
      // eslint-disable-next-line no-await-in-loop
      await sleep(CHECK_INTERVAL_MS);
    }

    if (docs.length) {
      const deleteIds = docs.filter((d) => d.requiresAck !== true).map((d) => d._id).filter(Boolean);
      const markDeliveredIds = docs
        .filter((d) => d.requiresAck === true && d.deliveredAt == null)
        .map((d) => d._id)
        .filter(Boolean);

      if (deleteIds.length) {
        await q.deleteMany({ _id: { $in: deleteIds } });
      }
      if (markDeliveredIds.length) {
        await q.updateMany(
          { _id: { $in: markDeliveredIds } },
          { $set: { deliveredAt: new Date() } }
        );
      }
    }

    const items = docs.map((d) => d?.payload).filter(Boolean);
    return res.status(200).json({ ok: true, items });
  } catch (e) {
    const msg = String(e?.message || "");
    const name = String(e?.name || "");
    const code = String(e?.code || "");
    console.error("[api/poll] error", { name, code, msg });
    return res.status(500).json({ error: "Poll failed" });
  }
}

