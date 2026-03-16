// Simple browser-side helper to connect to signaling WebSocket

let socket;
let listeners = [];
let lastOptions = {};

export function connectSignaling(userId, options = {}) {
  if (typeof window === "undefined") return null;

  if (options && options.username != null) {
    lastOptions = { username: options.username };
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }

  // Dev: set NEXT_PUBLIC_SIGNAL_WS=ws://localhost:3001 để dùng signal-server.js (HMR vẫn chạy)
  const wsBase =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SIGNAL_WS
      ? process.env.NEXT_PUBLIC_SIGNAL_WS
      : null;
  const defaultBase =
    window.location.protocol === "https:" ? "wss" : "ws";
  const hostBase = `${defaultBase}://${window.location.host}/api/signal`;
  const base = wsBase || hostBase;
  const url = `${base}?userId=${encodeURIComponent(userId)}`;

  socket = new WebSocket(url);

  socket.onopen = () => {
    if (lastOptions.username) {
      socket.send(JSON.stringify({ type: "register", username: lastOptions.username }));
    }
  };

  socket.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    listeners.forEach((fn) => fn(data));
  };

  socket.onclose = () => {
    socket = null;
    setTimeout(() => {
      try {
        connectSignaling(userId);
      } catch {
        // ignore
      }
    }, 3000);
  };

  return socket;
}

export function onSignalMessage(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((fn) => fn !== callback);
  };
}

export function sendSignal(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

