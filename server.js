/**
 * Custom server để xử lý WebSocket signaling.
 * Next.js mặc định không handle HTTP Upgrade, nên cần chạy server này thay vì "next dev".
 */
const http = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Signaling state (giống pages/api/signal.js)
const peers = new Map();
const usernameToUserId = new Map();

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Request error:", err);
      res.statusCode = 500;
      res.end("Internal error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { url } = request;
    if (!url || !url.startsWith("/api/signal")) {
      socket.destroy();
      return;
    }

    const query = url.split("?")[1] || "";
    const params = new URLSearchParams(query);
    const userId = params.get("userId");

    if (!userId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, userId);
    });
  });

  wss.on("connection", (ws, request, userId) => {
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
          ws.send(
            JSON.stringify({ type: "peer-unavailable", targetId })
          );
        } catch {
          // ignore
        }
        return;
      }

      try {
        targetSocket.send(
          JSON.stringify({ ...message, fromId: userId })
        );
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

  server
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket signaling: ws://${hostname}:${port}/api/signal`);
    });
});
