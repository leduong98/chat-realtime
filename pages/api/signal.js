// HTTP Long-Polling signaling server (works on Vercel)

// In-memory storage
const peers = new Map(); // userId -> { username, lastSeen }
const messageQueues = new Map(); // userId -> [messages]
const usernameToUserId = new Map(); // username -> userId

export default function handler(req, res) {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  if (req.method === "GET") {
    // GET: retrieve queued messages for this user
    const messages = messageQueues.get(userId) || [];
    messageQueues.delete(userId);

    // Update last seen
    if (peers.has(userId)) {
      const peer = peers.get(userId);
      peer.lastSeen = Date.now();
      peers.set(userId, peer);
    }

    res.status(200).json(messages);
    return;
  }

  if (req.method === "POST") {
    // POST: send a message to another user
    const { type, targetId, username, message } = req.body;

    // Register username
    if (type === "register" && username) {
      peers.set(userId, {
        username,
        lastSeen: Date.now(),
      });
      usernameToUserId.set(username, userId);
      return res.status(200).json({ ok: true });
    }

    if (!targetId) {
      return res.status(400).json({ error: "Missing targetId" });
    }

    // Find target user
    const targetUserId = usernameToUserId.get(targetId) || targetId;

    // Check if target exists
    if (!peers.has(targetUserId)) {
      return res.status(200).json({
        type: "peer-unavailable",
        targetId,
      });
    }

    // Queue message for target user
    if (!messageQueues.has(targetUserId)) {
      messageQueues.set(targetUserId, []);
    }

    messageQueues.get(targetUserId).push({
      type,
      targetId,
      message,
      fromId: userId,
      timestamp: Date.now(),
    });

    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
}

