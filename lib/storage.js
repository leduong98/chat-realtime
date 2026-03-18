const STORAGE_KEYS = {
  USER_ID: "sse-chat-user-id",
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

