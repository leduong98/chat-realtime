import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { getDb } from "../../lib/db";

const TTL_SECONDS = 60 * 60 * 24; // 1 day
const MAX_BATCH = 50;

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
    await q.createIndex({ toId: 1, createdAt: 1 });

    const docs = await q
      .find({ toId: userId })
      .sort({ createdAt: 1 })
      .limit(MAX_BATCH)
      .toArray();

    if (docs.length) {
      const ids = docs.map((d) => d._id).filter(Boolean);
      await q.deleteMany({ _id: { $in: ids } });
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

