const STORAGE_KEYS = {
  USER_ID: "sse-chat-user-id",
  PEERS: "sse-chat-peers",
  ACTIVE_PEER: "sse-chat-active-peer",
};

export function getOrCreateUserId() {
  if (typeof window === "undefined") return null;
  let id = window.localStorage.getItem(STORAGE_KEYS.USER_ID);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEYS.USER_ID, id);
  }
  return id;
}

export function loadPeers() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.PEERS);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function savePeers(peers) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.PEERS, JSON.stringify(peers || []));
}

export function loadActivePeer() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEYS.ACTIVE_PEER) || "";
}

export function saveActivePeer(peerId) {
  if (typeof window === "undefined") return;
  if (!peerId) {
    window.localStorage.removeItem(STORAGE_KEYS.ACTIVE_PEER);
    return;
  }
  window.localStorage.setItem(STORAGE_KEYS.ACTIVE_PEER, peerId);
}

function messagesKey(chatId) {
  return `sse-chat-messages:${chatId}`;
}

export function loadMessages(chatId) {
  if (typeof window === "undefined") return [];
  if (!chatId) return [];
  const raw = window.localStorage.getItem(messagesKey(chatId));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMessage(chatId, message) {
  if (typeof window === "undefined") return;
  if (!chatId) return;
  const messages = loadMessages(chatId);
  messages.push(message);
  window.localStorage.setItem(messagesKey(chatId), JSON.stringify(messages));
}

export function clearMessages(chatId) {
  if (typeof window === "undefined") return;
  if (!chatId) return;
  window.localStorage.removeItem(messagesKey(chatId));
}

