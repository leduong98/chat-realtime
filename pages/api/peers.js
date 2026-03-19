import { getServerSession } from "next-auth/next";
import { getDb } from "../../lib/db";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const username = String(session?.user?.username || "");
    if (!username) return res.status(401).json({ error: "Unauthorized" });

    const db = await getDb();
    const users = db.collection("users");

    if (req.method === "GET") {
      const user = await users.findOne({ username }, { projection: { peers: 1 } });
      return res.status(200).json({ ok: true, peers: Array.isArray(user?.peers) ? user.peers : [] });
    }

    if (req.method === "PUT") {
      const { peers } = req.body || {};
      const next = Array.isArray(peers) ? peers : [];
      // sanitize: { peerId, alias, createdAt }
      const clean = next
        .map((p) => ({
          peerId: String(p?.peerId || "").trim(),
          alias: String(p?.alias || "").trim(),
          createdAt: Number(p?.createdAt || Date.now()),
        }))
        .filter((p) => p.peerId);

      await users.updateOne(
        { username },
        { $set: { peers: clean, updatedAt: Date.now() } },
        { upsert: false }
      );
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("Missing MONGODB_URI")) {
      return res.status(500).json({ error: "Missing MONGODB_URI (Vercel env chưa set)" });
    }
    return res.status(500).json({ error: "Peers API failed" });
  }
}

