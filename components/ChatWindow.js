"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { getOrCreateUserId, loadMessages, saveMessage } from "../lib/storage";
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

  const [peerIdInput, setPeerIdInput] = useState("");
  const [peerId, setPeerId] = useState("");

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);

  const [sseStatus, setSseStatus] = useState("disconnected"); // connecting | connected | disconnected
  const sseRef = useRef(null);
  const peerTypingTimeoutRef = useRef(null);
  const bottomRef = useRef(null);

  const status = useMemo(() => {
    if (!peerId) return "disconnected";
    if (sseStatus === "connected") return "connected";
    if (sseStatus === "connecting") return "connecting";
    return "disconnected";
  }, [peerId, sseStatus]);

  useEffect(() => {
    const id = getOrCreateUserId();
    setUserId(id);
    setMounted(true);
  }, []);

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
        };

        setMessages((prev) => [...prev, item]);
        saveMessage(chatId, item);

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
    if (!peerId) return;
    setMessages(loadMessages(peerId));
  }, [peerId]);

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
    if (!userId || !peerId) return;
    // Fake typing indicator: only shows if peer is online with open SSE
    sendMessage({
      fromId: userId,
      toId: peerId,
      text: "",
      timestamp: Date.now(),
      type: "typing",
    }).catch(() => {});
  }

  async function handleSend() {
    const text = (input || "").trim();
    if (!text) return;
    if (!userId || !peerId) return;

    const local = {
      id: uuidv4(),
      chatId: peerId,
      senderId: userId,
      message: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, local]);
    saveMessage(peerId, local);
    setInput("");

    // Ephemeral send: no delivery guarantee if peer offline (no open SSE)
    sendMessage({
      fromId: userId,
      toId: peerId,
      text,
      timestamp: local.timestamp,
      type: "message",
    }).catch(() => {});
  }

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-slate-500 animate-pulse">Đang khởi tạo...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
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
        </div>
      </header>

      {/* Connect */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
          placeholder="Nhập peerId (userId của người kia)"
          value={peerIdInput}
          onChange={(e) => setPeerIdInput(e.target.value)}
        />
        <button
          type="button"
          className="px-5 py-2.5 rounded-2xl bg-[#22c55e] text-white text-sm font-semibold shadow-md shadow-green-200/50 hover:bg-[#16a34a] transition-all"
          onClick={handleConnectPeer}
        >
          Connect
        </button>
      </div>

      {/* Warning */}
      <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <div className="font-semibold mb-1">Cảnh báo</div>
        <div>
          This chat is ephemeral. Messages may be lost if the other user is offline.
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 bg-white/50 rounded-2xl p-3 min-h-0">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            isOwn={m.senderId === userId}
            message={m.message}
            timestamp={formatTime(m.timestamp)}
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
        disabled={status !== "connected"}
      />
    </div>
  );
}

