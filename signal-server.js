/**
 * Standalone WebSocket signaling server (chạy riêng port 3001).
 * Dùng khi chạy "next dev" để HMR vẫn hoạt động; app kết nối tới ws://localhost:3001
 */
const http = require("http");
const { WebSocketServer } = require("ws");

const SIGNAL_PORT = parseInt(process.env.SIGNAL_PORT || "3002", 10);

const peers = new Map();
const usernameToUserId = new Map();

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, signaling: true }));
});

const wss = new WebSocketServer({ server, path: "/" });

wss.on("connection", (ws, request) => {
  const url = request.url || "";
  const query = url.split("?")[1] || "";
  const params = new URLSearchParams(query);
  const userId = params.get("userId");

  if (!userId) {
    ws.close();
    return;
  }

  const existing = peers.get(userId);
  if (existing && existing.readyState === existing.OPEN) {
    existing.close();
  }
  peers.set(userId, ws);

  ws.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    const { type, targetId, username } = message || {};

    if (type === "register" && username) {
      usernameToUserId.set(username, userId);
      return;
    }

    if (!type || !targetId) return;

    const targetUserId = usernameToUserId.get(targetId) || targetId;
    const targetSocket = peers.get(targetUserId);

    if (!targetSocket || targetSocket.readyState !== targetSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "peer-unavailable", targetId }));
      } catch {
        // ignore
      }
      return;
    }

    try {
      targetSocket.send(JSON.stringify({ ...message, fromId: userId }));
    } catch {
      // ignore
    }
  });

  const removeUser = () => {
    if (peers.get(userId) === ws) {
      peers.delete(userId);
      for (const [u, id] of usernameToUserId.entries()) {
        if (id === userId) {
          usernameToUserId.delete(u);
          break;
        }
      }
    }
  };

  ws.on("close", removeUser);
  ws.on("error", removeUser);
});

server.listen(SIGNAL_PORT, () => {
  console.log(`> Signaling WebSocket: ws://localhost:${SIGNAL_PORT}`);
});
