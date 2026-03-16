// Simple WebSocket signaling server implemented via Next.js API route
// This uses the built-in "upgrade" event handling on the Node.js request
// to turn the HTTP connection into a WebSocket. It keeps everything
// in-memory: no database, and no message persistence on server.

import { WebSocketServer } from 'ws';

// In-memory: userId -> WebSocket
const peers = new Map();
// username (địa chỉ chat) -> userId, để tìm peer khi người ta paste "fox#1234"
const usernameToUserId = new Map();

let wss;

function initWebSocketServer(server) {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { url } = request;
    if (!url || !url.startsWith('/api/signal')) {
      return;
    }

    const [, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    const userId = params.get('userId');

    if (!userId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, userId);
    });
  });

  wss.on('connection', (ws, request, userId) => {
    const existing = peers.get(userId);
    if (existing && existing.readyState === existing.OPEN) {
      existing.close();
    }

    peers.set(userId, ws);

    ws.on('message', (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }

      const { type, targetId, username } = message || {};

      // Client gửi register ngay khi mở socket để server map username -> userId
      if (type === 'register' && username) {
        usernameToUserId.set(username, userId);
        return;
      }

      if (!type || !targetId) return;

      // Tìm socket: targetId có thể là username (fox#1234) hoặc userId (UUID)
      const targetUserId = usernameToUserId.get(targetId) || targetId;
      const targetSocket = peers.get(targetUserId);

      if (!targetSocket || targetSocket.readyState !== targetSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              type: 'peer-unavailable',
              targetId,
            })
          );
        } catch {
          // ignore
        }
        return;
      }

      try {
        targetSocket.send(
          JSON.stringify({
            ...message,
            fromId: userId,
          })
        );
      } catch {
        // ignore
      }
    });

    ws.on('close', () => {
      if (peers.get(userId) === ws) {
        peers.delete(userId);
        for (const [u, id] of usernameToUserId.entries()) {
          if (id === userId) {
            usernameToUserId.delete(u);
            break;
          }
        }
      }
    });

    ws.on('error', () => {
      if (peers.get(userId) === ws) {
        peers.delete(userId);
        for (const [u, id] of usernameToUserId.entries()) {
          if (id === userId) {
            usernameToUserId.delete(u);
            break;
          }
        }
      }
    });
  });

  return wss;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  // This handler will only respond to non-WebSocket requests.
  // For WebSocket, we rely on the Node.js 'upgrade' event configured
  // via initWebSocketServer in the custom server runtime.
  if (!res.socket.server._wssSignal) {
    res.socket.server._wssSignal = initWebSocketServer(res.socket.server);
  }

  if (req.method === 'GET') {
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).end();
}

