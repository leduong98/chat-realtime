import bcrypt from "bcryptjs";
import { getDb } from "../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");

  if (!u || u.length < 3 || u.length > 24) return res.status(400).json({ error: "Invalid username" });
  if (!/^[a-z0-9_]+$/.test(u)) return res.status(400).json({ error: "Username must be a-z 0-9 _" });
  if (!p || p.length < 6 || p.length > 72) return res.status(400).json({ error: "Invalid password" });

  const db = await getDb();
  const users = db.collection("users");
  const exists = await users.findOne({ username: u }, { projection: { _id: 1 } });
  if (exists) return res.status(409).json({ error: "Username already exists" });

  const passwordHash = await bcrypt.hash(p, 10);
  const now = Date.now();
  const doc = { username: u, passwordHash, peers: [], createdAt: now, updatedAt: now };
  await users.insertOne(doc);
  return res.status(200).json({ ok: true });
}

