"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import {
  getOrCreateUserId,
  loadMessages,
  saveMessage,
  loadPeers,
  savePeers,
  loadActivePeer,
  saveActivePeer,
} from "../lib/storage";
import { createSseClient } from "../lib/sseClient";
import { sendMessage } from "../lib/api";

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatWindow() {
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");

  const [peers, setPeers] = useState([]); // [{ peerId, alias, createdAt }]
  const [activePeerId, setActivePeerId] = useState("");
  const [newPeerId, setNewPeerId] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);

  const [sseStatus, setSseStatus] = useState("disconnected"); // connecting | connected | disconnected
  const sseRef = useRef(null);
  const peerTypingTimeoutRef = useRef(null);
  const bottomRef = useRef(null);

  const status = useMemo(() => {
    if (!activePeerId) return "disconnected";
    if (sseStatus === "connected") return "connected";
    if (sseStatus === "connecting") return "connecting";
    return "disconnected";
  }, [activePeerId, sseStatus]);

  useEffect(() => {
    const id = getOrCreateUserId();
    setUserId(id);
    setMounted(true);
  }, []);

  // Load saved peer list + active peer
  useEffect(() => {
    const list = loadPeers();
    setPeers(list);
    const active = loadActivePeer();
    if (active) setActivePeerId(active);
  }, []);

  // Browser notification permission (best-effort)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  async function handleCopyMyId() {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      alert("Không copy được. Hãy copy thủ công userId.");
    }
  }

  // SSE connect & auto-reconnect
  useEffect(() => {
    if (!userId) return;

    if (sseRef.current) {
      sseRef.current.stop();
      sseRef.current = null;
    }

    sseRef.current = createSseClient({
      userId,
      onStatus: setSseStatus,
      onMessage: (msg) => {
        // msg: { id, fromId, toId, text, timestamp, type }
        if (!msg || !msg.type) return;

        if (msg.type === "typing") {
          setPeerTyping(true);
          if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
          peerTypingTimeoutRef.current = setTimeout(() => setPeerTyping(false), 1200);
          return;
        }

        if (msg.type !== "message") return;

        const chatId = msg.fromId;
        const item = {
          id: msg.id || uuidv4(),
          chatId,
          senderId: msg.fromId,
          message: msg.text,
          timestamp: msg.timestamp,
          kind: msg.kind || (String(msg.text || "").startsWith("data:image/") ? "image" : "text"),
        };

        setMessages((prev) => [...prev, item]);
        saveMessage(chatId, item);

        // Toast in-app
        setToast("Bạn có tin nhắn mới");
        setTimeout(() => setToast(""), 1600);

        // Browser notification when tab hidden
        try {
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            new Notification("Tin nhắn mới", {
              body: msg.text || "",
            });
          }
        } catch {
          // ignore
        }

        // Bonus: sound notification (best-effort)
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = 660;
          g.gain.value = 0.03;
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          setTimeout(() => {
            o.stop();
            ctx.close();
          }, 80);
        } catch {
          // ignore
        }
      },
    });

    return () => {
      if (sseRef.current) {
        sseRef.current.stop();
        sseRef.current = null;
      }
    };
  }, [userId]);

  // Load local history when selecting peer
  useEffect(() => {
    if (!activePeerId) return;
    setMessages(loadMessages(activePeerId));
    saveActivePeer(activePeerId);
  }, [activePeerId]);

  // Auto scroll
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function handleConnectPeer() {
    const v = (peerIdInput || "").trim();
    if (!v) return;
    setPeerId(v);
  }

  function handleTyping() {
    if (!userId || !activePeerId) return;
    // Fake typing indicator: only shows if peer is online with open SSE
    sendMessage({
      fromId: userId,
      toId: activePeerId,
      text: "",
      timestamp: Date.now(),
      type: "typing",
    }).catch(() => {});
  }

  async function handleSend() {
    const text = (input || "").trim();
    if (!text) return;
    if (!userId || !activePeerId) return;

    const local = {
      id: uuidv4(),
      chatId: activePeerId,
      senderId: userId,
      message: text,
      timestamp: Date.now(),
      kind: "text",
    };

    setMessages((prev) => [...prev, local]);
    saveMessage(activePeerId, local);
    setInput("");

    // Ephemeral send: no delivery guarantee if peer offline (no open SSE)
    sendMessage({
      fromId: userId,
      toId: activePeerId,
      text,
      timestamp: local.timestamp,
      type: "message",
    }).catch(() => {});
  }

  async function handleSendImage(dataUrl) {
    const text = String(dataUrl || "");
    if (!text.startsWith("data:image/")) return;
    if (!userId || !activePeerId) return;

    const local = {
      id: uuidv4(),
      chatId: activePeerId,
      senderId: userId,
      message: text,
      timestamp: Date.now(),
      kind: "image",
    };

    setMessages((prev) => [...prev, local]);
    saveMessage(activePeerId, local);

    sendMessage({
      fromId: userId,
      toId: activePeerId,
      text,
      timestamp: local.timestamp,
      type: "message",
      kind: "image",
    }).catch(() => {});
  }

  function addPeer() {
    const pid = (newPeerId || "").trim();
    const alias = (newAlias || "").trim();
    if (!pid) return;
    if (pid === userId) {
      alert("Không thể connect chính mình.");
      return;
    }
    const exists = peers.some((p) => p.peerId === pid);
    const next = exists
      ? peers.map((p) => (p.peerId === pid ? { ...p, alias: alias || p.alias } : p))
      : [{ peerId: pid, alias: alias || pid.slice(0, 8), createdAt: Date.now() }, ...peers];
    setPeers(next);
    savePeers(next);
    setActivePeerId(pid);
    setNewPeerId("");
    setNewAlias("");
    setShowAdd(false);
  }

  function removePeer(pid) {
    const next = peers.filter((p) => p.peerId !== pid);
    setPeers(next);
    savePeers(next);
    if (activePeerId === pid) {
      const fallback = next[0]?.peerId || "";
      setActivePeerId(fallback);
      saveActivePeer(fallback);
    }
  }

  const activePeer = peers.find((p) => p.peerId === activePeerId) || null;

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-slate-500 animate-pulse">Đang khởi tạo...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {toast ? (
        <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {toast}
        </div>
      ) : null}
      {/* Header */}
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-lg">
            👤
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500">User ID</div>
            <div className="font-semibold text-slate-800 truncate">{userId}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${
              status === "connected"
                ? "bg-green-100 text-green-700"
                : status === "connecting"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === "connected"
                  ? "bg-green-500"
                  : status === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-slate-400"
              }`}
            />
            {status}
          </span>
          <button
            type="button"
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
              copied
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
            onClick={handleCopyMyId}
            title="Copy userId để gửi cho người kia"
          >
            {copied ? "✅ Copied" : "📋 Copy ID"}
          </button>
        </div>
      </header>

      {/* Peers */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-sm font-semibold text-slate-700">
            Đang chat với:{" "}
            <span className="text-slate-900">
              {activePeer ? activePeer.alias : "Chưa chọn"}
            </span>
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200 transition-colors"
            onClick={() => setShowAdd((v) => !v)}
          >
            ➕ Kết nối mới
          </button>
        </div>

        {showAdd ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
                placeholder="peerId (userId người kia)"
                value={newPeerId}
                onChange={(e) => setNewPeerId(e.target.value)}
              />
              <input
                type="text"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
                placeholder="Biệt danh (vd: Anh A)"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
              />
              <button
                type="button"
                className="px-5 py-2.5 rounded-2xl bg-[#22c55e] text-white text-sm font-semibold shadow-md shadow-green-200/50 hover:bg-[#16a34a] transition-all"
                onClick={addPeer}
              >
                Thêm & mở chat
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Gợi ý: người kia bấm “Copy ID” và gửi cho bạn.
            </div>
          </div>
        ) : null}

        {peers.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {peers.map((p) => (
              <div
                key={p.peerId}
                className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-sm ${
                  p.peerId === activePeerId
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setActivePeerId(p.peerId)}
                  title={p.peerId}
                >
                  <div className="font-semibold leading-4">{p.alias}</div>
                  <div className="text-[11px] text-slate-500 leading-4">
                    {p.peerId.slice(0, 8)}…
                  </div>
                </button>
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-500"
                  onClick={() => removePeer(p.peerId)}
                  title="Xóa khỏi danh sách"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            Chưa có kết nối nào. Bấm “Kết nối mới” để thêm peer.
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 bg-white/50 rounded-2xl p-3 min-h-0">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            isOwn={m.senderId === userId}
            message={m.message}
            timestamp={formatTime(m.timestamp)}
            kind={m.kind}
          />
        ))}
        {peerTyping && (
          <div className="text-xs text-amber-600 italic mb-2 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Đang nhập...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onTyping={handleTyping}
        onSendImage={handleSendImage}
        disabled={status !== "connected"}
      />
    </div>
  );
}

