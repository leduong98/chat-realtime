const STORAGE_KEYS = {
  USER_ID: "sse-chat-user-id",
  PEERS: "sse-chat-peers",
  ACTIVE_PEER: "sse-chat-active-peer",
};

// ---------------------------
// Messages storage (IndexedDB)
// ---------------------------

const LEGACY_MESSAGES_PREFIX = "sse-chat-messages:";
const DB_NAME = "pi-chat";
const DB_VERSION = 1;
const STORE_MESSAGES = "messages";

let _dbPromise = null;

function hasIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb() {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const store = db.createObjectStore(STORE_MESSAGES, { keyPath: "pk" });
        store.createIndex("by_chatId", "chatId", { unique: false });
        store.createIndex("by_chatId_ts", ["chatId", "timestamp"], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return _dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function legacyKey(chatId) {
  return `${LEGACY_MESSAGES_PREFIX}${chatId}`;
}

async function migrateLegacyMessages(chatId) {
  if (typeof window === "undefined") return;
  if (!chatId) return;
  const raw = window.localStorage.getItem(legacyKey(chatId));
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return;
    await saveMessages(chatId, parsed);
    window.localStorage.removeItem(legacyKey(chatId));
  } catch {
    // ignore
  }
}

async function idbGetAllMessages(chatId) {
  const db = await openDb();
  if (!db) return [];
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readonly");
    const store = tx.objectStore(STORE_MESSAGES);
    const idx = store.index("by_chatId");
    const req = idx.getAll(chatId);
    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? req.result : [];
      const items = rows
        .map((r) => r && r.value)
        .filter(Boolean)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbPutMessage(chatId, message) {
  const db = await openDb();
  if (!db) return;
  const pk = `${chatId}:${message.id}`;
  const tx = db.transaction(STORE_MESSAGES, "readwrite");
  const store = tx.objectStore(STORE_MESSAGES);
  store.put({
    pk,
    chatId,
    id: message.id,
    timestamp: message.timestamp || 0,
    value: message,
  });
  return await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbDeleteByChatId(chatId) {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE_MESSAGES, "readwrite");
  const store = tx.objectStore(STORE_MESSAGES);
  const idx = store.index("by_chatId");
  await new Promise((resolve, reject) => {
    const cursorReq = idx.openCursor(chatId);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return resolve();
      cursor.delete();
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  return await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbUpdateMessage(chatId, messageId, patch) {
  const db = await openDb();
  if (!db) return;
  const pk = `${chatId}:${messageId}`;
  const tx = db.transaction(STORE_MESSAGES, "readwrite");
  const store = tx.objectStore(STORE_MESSAGES);
  const existing = await reqToPromise(store.get(pk));
  const nextValue = { ...(existing?.value || {}), ...(patch || {}) };
  store.put({
    pk,
    chatId,
    id: messageId,
    timestamp: nextValue.timestamp || existing?.timestamp || 0,
    value: nextValue,
  });
  return await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

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

export async function loadMessages(chatId) {
  if (typeof window === "undefined") return [];
  if (!chatId) return [];

  // migrate legacy localStorage once per chatId (best-effort)
  await migrateLegacyMessages(chatId);

  try {
    if (hasIndexedDb()) {
      return await idbGetAllMessages(chatId);
    }
  } catch {
    // fallback below
  }

  // Fallback to legacy localStorage if IndexedDB not available
  const raw = window.localStorage.getItem(legacyKey(chatId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveMessage(chatId, message) {
  if (typeof window === "undefined") return;
  if (!chatId || !message) return;
  if (hasIndexedDb()) {
    try {
      await idbPutMessage(chatId, message);
      return;
    } catch {
      // fallback below
    }
  }

  // Fallback to legacy localStorage
  const messages = await loadMessages(chatId);
  messages.push(message);
  window.localStorage.setItem(legacyKey(chatId), JSON.stringify(messages));
}

export async function saveMessages(chatId, messages) {
  if (typeof window === "undefined") return;
  if (!chatId) return;
  const list = Array.isArray(messages) ? messages : [];
  if (hasIndexedDb()) {
    try {
      await idbDeleteByChatId(chatId);
      for (const m of list) {
        if (!m || !m.id) continue;
        // eslint-disable-next-line no-await-in-loop
        await idbPutMessage(chatId, m);
      }
      return;
    } catch {
      // fallback below
    }
  }
  window.localStorage.setItem(legacyKey(chatId), JSON.stringify(list));
}

export async function updateMessage(chatId, messageId, patch) {
  if (typeof window === "undefined") return;
  if (!chatId || !messageId) return;
  if (hasIndexedDb()) {
    try {
      await idbUpdateMessage(chatId, messageId, patch);
      return;
    } catch {
      // fallback below
    }
  }
  const messages = await loadMessages(chatId);
  const next = messages.map((m) => (m && m.id === messageId ? { ...m, ...(patch || {}) } : m));
  window.localStorage.setItem(legacyKey(chatId), JSON.stringify(next));
}

export async function clearMessages(chatId) {
  if (typeof window === "undefined") return;
  if (!chatId) return;
  if (hasIndexedDb()) {
    try {
      await idbDeleteByChatId(chatId);
      return;
    } catch {
      // fallback below
    }
  }
  window.localStorage.removeItem(legacyKey(chatId));
}

