import bcrypt from "bcryptjs";
import { getDb } from "../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { username, password } = req.body || {};
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "");

    if (!u || u.length < 3 || u.length > 24) return res.status(400).json({ error: "Invalid username" });
    if (!/^[a-z0-9_]+$/.test(u)) return res.status(400).json({ error: "Username must be a-z 0-9 _" });
    if (!p || p.length < 6 || p.length > 72) return res.status(400).json({ error: "Invalid password" });

    const db = await getDb();
    const users = db.collection("users");
    await users.createIndex({ username: 1 }, { unique: true });

    const passwordHash = await bcrypt.hash(p, 10);
    const now = Date.now();
    const doc = { username: u, passwordHash, peers: [], createdAt: now, updatedAt: now };

    await users.insertOne(doc);
    return res.status(200).json({ ok: true });
  } catch (e) {
    const msg = String(e?.message || "");
    const code = String(e?.code || "");
    const name = String(e?.name || "");

    // Log to Vercel Functions Logs (do not include secrets)
    console.error("[api/register] error", { name, code, msg });

    if (msg.includes("E11000") || code === "11000") {
      return res.status(409).json({ error: "Username already exists", errorCode: "DUPLICATE_USERNAME" });
    }
    if (msg.includes("Missing MONGODB_URI")) {
      return res
        .status(500)
        .json({ error: "Missing MONGODB_URI (Vercel env chưa set)", errorCode: "MISSING_MONGODB_URI" });
    }
    if (name === "MongoServerError" || name === "MongoNetworkError" || msg.toLowerCase().includes("mongodb")) {
      return res.status(500).json({ error: "MongoDB error", errorCode: "MONGODB_ERROR" });
    }
    return res.status(500).json({ error: "Register failed", errorCode: "UNKNOWN" });
  }
}

