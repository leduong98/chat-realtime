const STORAGE_KEYS = {
  USER_ID: "webrtc-chat-user-id",
  USERNAME: "webrtc-chat-username",
  MESSAGES: "webrtc-chat-messages",
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

export function getUsername() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEYS.USERNAME);
}

export function saveUsername(username) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.USERNAME, username);
}

export function loadMessages() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.MESSAGES);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMessage(message) {
  if (typeof window === "undefined") return;
  const messages = loadMessages();
  messages.push(message);
  window.localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
}

export function clearMessages() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEYS.MESSAGES);
}

