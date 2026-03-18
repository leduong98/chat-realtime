"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import {
  getOrCreateUserId,
  loadMessages,
  saveMessage,
  saveMessages,
  loadPeers,
  savePeers,
  loadActivePeer,
  saveActivePeer,
} from "../lib/storage";
import { createSseClient } from "../lib/sseClient";
import { sendMessage } from "../lib/api";
import {
  Check,
  ClipboardCopy,
  Plus,
  User,
  X,
} from "lucide-react";

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

        if (msg.type === "ack") {
          const chatId = msg.fromId;
          const targetId = msg.data?.targetMessageId;
          const st = msg.data?.status;
          if (!chatId || !targetId || (st !== "delivered" && st !== "seen")) return;

          setMessages((prev) => {
            const next = prev.map((m) => (m && m.id === targetId ? { ...m, status: st } : m));
            saveMessages(chatId, next);
            return next;
          });
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

        // ACK delivered back to sender (best-effort)
        sendMessage({
          fromId: userId,
          toId: msg.fromId,
          text: "",
          timestamp: Date.now(),
          type: "ack",
          data: { targetMessageId: item.id, status: "delivered" },
        }).catch(() => {});

        // ACK seen if đang mở đúng đoạn chat và tab đang active
        try {
          if (!document.hidden && activePeerId === msg.fromId) {
            sendMessage({
              fromId: userId,
              toId: msg.fromId,
              text: "",
              timestamp: Date.now(),
              type: "ack",
              data: { targetMessageId: item.id, status: "seen" },
            }).catch(() => {});
          }
        } catch {
          // ignore
        }

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
      status: "sent",
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
      clientMessageId: local.id,
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
      status: "sent",
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
      clientMessageId: local.id,
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
    <div className="flex h-full gap-4">
      {/* Sidebar (left) */}
      <aside className="flex-3 min-w-[280px] max-w-[380px] flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
        {/* Top row: user + actions */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--card-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[var(--muted)]">User ID</div>
              <div className="font-semibold text-[var(--fg)] truncate">{userId}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <button
              type="button"
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                copied
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-[var(--card-2)] text-[var(--fg)] border-[var(--border)] hover:bg-[var(--card)]"
              } cursor-pointer`}
              onClick={handleCopyMyId}
              title="Copy userId để gửi cho người kia"
            >
              <span className="inline-flex items-center gap-2">
                {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </span>
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-[var(--muted)]">Trạng thái</div>
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
        </div>

        {/* Active peer header */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-[var(--muted)]">
            Đoạn chat
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-[var(--card-2)] text-[var(--fg)] text-xs font-semibold hover:bg-[var(--card)] transition-colors border border-[var(--border)] cursor-pointer"
            onClick={() => setShowAdd((v) => !v)}
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Kết nối mới
            </span>
          </button>
        </div>

        {showAdd ? (
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
                placeholder="peerId (userId người kia)"
                value={newPeerId}
                onChange={(e) => setNewPeerId(e.target.value)}
              />
              <input
                type="text"
                className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
                placeholder="Biệt danh (vd: Tiệp)"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
              />
              <button
                type="button"
                className="px-5 py-2.5 rounded-2xl bg-[var(--primary)] text-white text-sm font-semibold shadow-sm hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
                onClick={addPeer}
              >
                Thêm & mở chat
              </button>
            </div>
          </div>
        ) : null}

        {/* Peer list */}
        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          {peers.length ? (
            <div className="space-y-2">
              {peers.map((p) => (
                <div key={p.peerId} className="relative">
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border cursor-pointer text-left ${
                      p.peerId === activePeerId
                        ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                        : "bg-[var(--card)] border-[var(--border)] text-[var(--fg)]"
                    }`}
                    onClick={() => setActivePeerId(p.peerId)}
                    title={p.peerId}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold leading-5 truncate">{p.alias}</div>
                      <div
                        className={`text-[11px] leading-4 ${
                          p.peerId === activePeerId ? "text-white/70" : "text-[var(--muted)]"
                        }`}
                      >
                        {p.peerId.slice(0, 8)}…
                      </div>
                    </div>
                    <span className="sr-only">Mở chat</span>
                  </button>
                  <button
                    type="button"
                    className={`shrink-0 cursor-pointer ${
                      p.peerId === activePeerId
                        ? "text-white/80 hover:text-white"
                        : "text-[var(--muted)] hover:text-red-500"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePeer(p.peerId);
                    }}
                    title="Xóa khỏi danh sách"
                    style={{ position: "absolute", right: 12, top: 10 }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">
              Chưa có kết nối nào. Bấm “Kết nối mới” để thêm peer.
            </div>
          )}
        </div>
      </aside>

      {/* Chat area (right) */}
      <section className="flex-7 min-w-0 flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
        {toast ? (
          <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {toast}
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs text-[var(--muted)]">Đang chat với</div>
            <div className="font-semibold text-[var(--fg)] truncate">
              {activePeer ? activePeer.alias : "Chưa chọn peer"}
            </div>
          </div>
          {activePeer ? (
            <div className="text-xs text-[var(--muted)] truncate max-w-[260px]" title={activePeer.peerId}>
              {activePeer.peerId}
            </div>
          ) : null}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 bg-[var(--card)]/50 rounded-2xl p-3 min-h-0 border border-[var(--border)]">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              isOwn={m.senderId === userId}
              message={m.message}
              timestamp={formatTime(m.timestamp)}
              kind={m.kind}
              status={m.status}
            />
          ))}
          {peerTyping && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--primary)]/70 animate-pulse" />
              <span className="font-medium">Đang nhập…</span>
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
      </section>
    </div>
  );
}

