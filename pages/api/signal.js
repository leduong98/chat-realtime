/**
 * Signaling qua HTTP polling (không dùng WebSocket).
 * - GET ?userId=xxx&username=yyy  → trả về hàng đợi tin nhắn cho userId, đăng ký username nếu có.
 * - POST body: { fromId, targetId, type, offer?|answer?|candidate? } → đẩy tin vào hàng đợi của targetId.
 */

// In-memory: userId -> mảng tin nhắn chờ lấy
const messageQueues = new Map();
// username (địa chỉ chat) -> userId, để resolve targetId khi gửi
const usernameToUserId = new Map();

function getQueue(userId) {
  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, []);
  }
  return messageQueues.get(userId);
}

export default async function handler(req, res) {
  // GET: poll tin nhắn cho userId, optional đăng ký username
  if (req.method === "GET") {
    const userId = req.query.userId;
    const username = req.query.username;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    if (username) {
      usernameToUserId.set(username, userId);
    }

    const queue = getQueue(userId);
    const messages = [...queue];
    queue.length = 0;

    // Ưu tiên offer/answer trước ice-candidate để client set remoteDescription trước khi add ICE
    const order = { offer: 0, answer: 1, "ice-candidate": 2 };
    messages.sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3));

    return res.status(200).json({ messages });
  }

  // POST: gửi tin nhắn tới targetId (offer, answer, ice-candidate, typing, peer-unavailable)
  if (req.method === "POST") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { fromId, targetId, type } = body;
    if (!fromId || !targetId || !type) {
      return res.status(400).json({ error: "Missing fromId, targetId or type" });
    }

    // Resolve targetId: có thể là username (fox#1234) hoặc userId (UUID)
    const targetUserId = usernameToUserId.get(targetId) || targetId;
    const targetQueue = getQueue(targetUserId);

    targetQueue.push({
      fromId,
      type,
      offer: body.offer,
      answer: body.answer,
      candidate: body.candidate,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
