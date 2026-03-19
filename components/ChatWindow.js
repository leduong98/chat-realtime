"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSession } from "next-auth/react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import {
  getOrCreateUserId,
  loadMessages,
  getLastMessage,
  saveMessage,
  saveMessages,
  clearMessages,
  loadPeers,
  savePeers,
  loadActivePeer,
  saveActivePeer,
} from "../lib/storage";
import { createPollClient } from "../lib/pollClient";
import { sendMessage } from "../lib/api";
import {
  Check,
  ClipboardCopy,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
  User,
  X,
} from "lucide-react";
import { applyTheme, getInitialTheme, saveTheme } from "../lib/theme";
import { signOut } from "next-auth/react";

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatWindow() {
  const { data: session, status: authStatus } = useSession();
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");

  const [peers, setPeers] = useState([]); // [{ peerId, alias, createdAt }]
  const [activePeerId, setActivePeerId] = useState("");
  const [newPeerId, setNewPeerId] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);

  // Sidebar: preview tin cuối, unread, trạng thái online (heuristic: hoạt động trong 3 phút)
  const [lastMessageByPeerId, setLastMessageByPeerId] = useState({});
  const [unreadPeerIds, setUnreadPeerIds] = useState({}); // { [peerId]: true }
  const [peerLastActivity, setPeerLastActivity] = useState({}); // { [peerId]: timestamp }
  const [confirmRemovePeerId, setConfirmRemovePeerId] = useState(null); // pid khi đang hỏi xác nhận xóa
  const [sidebarOpen, setSidebarOpen] = useState(false); // drawer trên mobile
  const [theme, setTheme] = useState("light");

  const [sseStatus, setSseStatus] = useState("disconnected"); // reusing status labels for UI
  const pollRef = useRef(null);
  const activePeerIdRef = useRef(activePeerId);
  const peerTypingTimeoutRef = useRef(null);
  const bottomRef = useRef(null);
  const baseTitleRef = useRef(null);
  const titleNoticeRef = useRef(null); // { peerId, label }

  useEffect(() => {
    activePeerIdRef.current = activePeerId;
  }, [activePeerId]);

  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }

  const status = useMemo(() => {
    if (!activePeerId) return "disconnected";
    if (sseStatus === "connected") return "connected";
    if (sseStatus === "connecting") return "connecting";
    return "disconnected";
  }, [activePeerId, sseStatus]);

  useEffect(() => {
    const username = String(session?.user?.username || "").trim();
    if (username) {
      setUserId(username);
    } else {
      const id = getOrCreateUserId();
      setUserId(id);
    }
    setMounted(true);
  }, [session?.user?.username]);

  // Base tab title + reset on focus/visibility
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!baseTitleRef.current) baseTitleRef.current = document.title || "PI-Chat";

    const reset = () => {
      if (!baseTitleRef.current) return;
      titleNoticeRef.current = null;
      document.title = baseTitleRef.current;
    };

    const onVis = () => {
      if (!document.hidden) reset();
    };
    const onFocus = () => reset();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Load saved peer list + active peer
  useEffect(() => {
    const list = loadPeers();
    setPeers(list);
    const active = loadActivePeer();
    if (active) setActivePeerId(active);
  }, []);

  // If logged in: fetch peers from DB (so login anywhere sees old connects)
  useEffect(() => {
    const username = String(session?.user?.username || "").trim();
    if (!username) return;
    (async () => {
      try {
        const res = await fetch("/api/peers");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.peers)) {
          setPeers(data.peers);
          savePeers(data.peers);
        }
      } catch {
        // ignore
      }
    })();
  }, [session?.user?.username]);

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

    if (pollRef.current) {
      pollRef.current.stop();
      pollRef.current = null;
    }

    pollRef.current = createPollClient({
      userId,
      onStatus: setSseStatus,
      onMessage: (msg) => {
        // msg: { id, fromId, toId, text, timestamp, type }
        if (!msg || !msg.type) return;

        if (msg.type === "typing") {
          setPeerLastActivity((prev) => ({ ...prev, [msg.fromId]: Date.now() }));
          if (activePeerIdRef.current !== msg.fromId) return;
          setPeerTyping(true);
          if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
          peerTypingTimeoutRef.current = setTimeout(() => setPeerTyping(false), 1200);
          return;
        }

        if (msg.type === "invite") {
          const fromId = msg.fromId;
          const inviterName = String(msg.data?.inviterName || "").trim();
          const inviteeName = String(msg.data?.inviteeName || "").trim();
          if (!fromId || !inviterName || !inviteeName) return;

          // Auto-add / update peer with inviter's chosen name
          setPeers((prev) => {
            const exists = prev.some((p) => p.peerId === fromId);
            const next = exists
              ? prev.map((p) => (p.peerId === fromId ? { ...p, alias: inviterName } : p))
              : [{ peerId: fromId, alias: inviterName, createdAt: Date.now() }, ...prev];
            savePeers(next);
            if (String(session?.user?.username || "").trim()) {
              fetch("/api/peers", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ peers: next }),
              }).catch(() => {});
            }
            return next;
          });

          setActivePeerId(fromId);
          setToast(`Đã thêm kết nối: ${inviterName}`);
          setTimeout(() => setToast(""), 1600);
          return;
        }

        if (msg.type === "ack") {
          const chatId = msg.fromId;
          const targetId = msg.data?.targetMessageId;
          const st = msg.data?.status;
          if (!chatId || !targetId || (st !== "delivered" && st !== "seen")) return;
          // Chỉ cập nhật UI khi đang mở đúng cuộc hội thoại với peer gửi ack
          if (activePeerIdRef.current !== chatId) return;
          setMessages((prev) => {
            const next = prev.map((m) => (m && m.id === targetId ? { ...m, status: st } : m));
            saveMessages(chatId, next).catch(() => {});
            return next;
          });
          return;
        }

        if (msg.type !== "message") return;

        const chatId = msg.fromId;
        // Tab title notify for new incoming message
        try {
          if (typeof document !== "undefined" && baseTitleRef.current) {
            const alias = peers.find((p) => p.peerId === chatId)?.alias || chatId.slice(0, 8);
            const label = alias.length > 10 ? `${alias.slice(0, 10)}…` : alias;
            if (document.hidden || activePeerId !== chatId) {
              titleNoticeRef.current = { peerId: chatId, label };
              document.title = `(${label}) ${baseTitleRef.current}`;
            }
          }
        } catch {
          // ignore
        }

        const item = {
          id: msg.id || uuidv4(),
          chatId,
          senderId: msg.fromId,
          message: msg.text,
          timestamp: msg.timestamp,
          kind: msg.kind || (String(msg.text || "").startsWith("data:image/") ? "image" : "text"),
        };

        // Luôn lưu vào IndexedDB theo đúng cuộc hội thoại
        saveMessage(chatId, item).catch(() => {});
        // Sidebar: cập nhật hoạt động + preview + unread nếu không đang mở chat này
        setPeerLastActivity((prev) => ({ ...prev, [chatId]: Date.now() }));
        setLastMessageByPeerId((prev) => ({
          ...prev,
          [chatId]: { message: msg.text, timestamp: msg.timestamp, senderId: msg.fromId },
        }));
        if (activePeerIdRef.current !== chatId) {
          setUnreadPeerIds((prev) => ({ ...prev, [chatId]: true }));
        }
        // Chỉ append vào UI khi đang mở đúng chat với peer gửi tin (tránh lỗi chat nhiều người)
        if (activePeerIdRef.current === chatId) {
          setMessages((prev) => [...prev, item]);
        }

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
      if (pollRef.current) {
        pollRef.current.stop();
        pollRef.current = null;
      }
    };
  }, [userId]);

  // Load local history when selecting peer
  useEffect(() => {
    if (!activePeerId) return;
    setUnreadPeerIds((prev) => {
      const next = { ...prev };
      delete next[activePeerId];
      return next;
    });
    let alive = true;
    (async () => {
      const list = await loadMessages(activePeerId);
      if (!alive) return;
      setMessages(list);
      saveActivePeer(activePeerId);
    })();
    return () => {
      alive = false;
    };
  }, [activePeerId]);

  // Load preview tin cuối cho từng peer (sidebar)
  useEffect(() => {
    if (!peers.length) return;
    let alive = true;
    (async () => {
      const next = {};
      for (const p of peers) {
        if (!alive) return;
        const last = await getLastMessage(p.peerId);
        if (last) next[p.peerId] = { message: last.message, timestamp: last.timestamp, senderId: last.senderId };
      }
      if (alive) setLastMessageByPeerId((prev) => ({ ...prev, ...next }));
    })();
    return () => { alive = false; };
  }, [peers]);

  // Nếu đang có thông báo trên title và user mở đúng session đó -> reset title
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!baseTitleRef.current) return;
    const n = titleNoticeRef.current;
    if (n && n.peerId === activePeerId && !document.hidden) {
      titleNoticeRef.current = null;
      document.title = baseTitleRef.current;
    }
  }, [activePeerId]);

  function scrollToBottom(behavior) {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: behavior || "auto", block: "end" });
  }

  // Khi đổi session: nhảy thẳng xuống cuối (không smooth)
  useEffect(() => {
    if (!activePeerId) return;
    // đợi DOM render xong messages mới rồi scroll
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom("auto")));
  }, [activePeerId]);

  // Khi có tin nhắn mới: scroll mượt xuống cuối
  useEffect(() => {
    scrollToBottom("smooth");
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
    saveMessage(activePeerId, local).catch(() => {});
    setLastMessageByPeerId((prev) => ({
      ...prev,
      [activePeerId]: { message: text, timestamp: local.timestamp, senderId: userId },
    }));
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
    saveMessage(activePeerId, local).catch(() => {});

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
    if (!pid) return;
    if (pid === userId) {
      alert("Không thể connect chính mình.");
      return;
    }

    const exists = peers.some((p) => p.peerId === pid);
    const next = exists
      ? peers.map((p) => (p.peerId === pid ? { ...p, alias: pid } : p))
      : [{ peerId: pid, alias: pid, createdAt: Date.now() }, ...peers];
    setPeers(next);
    savePeers(next);
    setActivePeerId(pid);
    setNewPeerId("");
    setShowAdd(false);

    // One-way connect: send invite so receiver auto-adds me + sets their name
    sendMessage({
      fromId: userId,
      toId: pid,
      text: "",
      timestamp: Date.now(),
      type: "invite",
      data: {
        inviterName: String(userId || "").trim(),
        inviteeName: pid,
      },
    }).catch(() => {});

    // Persist peers to DB if logged in
    if (String(session?.user?.username || "").trim()) {
      fetch("/api/peers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peers: next }),
      }).catch(() => {});
    }
  }

  function removePeer(pid) {
    const next = peers.filter((p) => p.peerId !== pid);
    setPeers(next);
    savePeers(next);
    if (String(session?.user?.username || "").trim()) {
      fetch("/api/peers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peers: next }),
      }).catch(() => {});
    }
    if (activePeerId === pid) {
      const fallback = next[0]?.peerId || "";
      setActivePeerId(fallback);
      saveActivePeer(fallback);
    }
  }

  async function confirmRemovePeer(pid) {
    await clearMessages(pid);
    setLastMessageByPeerId((prev) => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });
    setUnreadPeerIds((prev) => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });
    setPeerLastActivity((prev) => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });
    removePeer(pid);
    setConfirmRemovePeerId(null);
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
    <div className="flex h-full min-h-0 gap-4 relative">
      {/* Drawer overlay (mobile) */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Sidebar (left) - desktop: luôn hiện; mobile: trong drawer */}
      <aside
        className={`flex-3 min-w-[280px] max-w-[380px] flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4
          hidden md:flex md:relative
          ${sidebarOpen ? "!flex max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[85vw] max-md:max-w-[320px] max-md:rounded-r-3xl max-md:rounded-l-none max-md:shadow-xl" : ""}`}
      >
        {/* Top row: user + actions (profile) */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--card-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)]">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              {session?.user?.name ? (
                <>
                  <div className="font-semibold text-[var(--fg)] truncate">{String(session.user.name)}</div>
                  <div className="text-xs text-[var(--muted)] truncate">{userId}</div>
                </>
              ) : (
                <>
                  <div className="text-xs text-[var(--muted)]">User ID</div>
                  <div className="font-semibold text-[var(--fg)] truncate">{userId}</div>
                </>
              )}
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

        {/* Status (Trạng thái) */}
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
            <div className="flex items-center justify-end mb-2">
              <button
                type="button"
                className="p-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                onClick={() => {
                  setShowAdd(false);
                  setNewPeerId("");
                }}
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
                placeholder="username"
                value={newPeerId}
                onChange={(e) => setNewPeerId(e.target.value)}
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
              {peers.map((p) => {
                const last = lastMessageByPeerId[p.peerId];
                const preview = last?.message != null
                  ? (String(last.message).startsWith("data:image/") ? "🖼 Ảnh" : String(last.message).slice(0, 36) + (String(last.message).length > 36 ? "…" : ""))
                  : "Chưa có tin nhắn";
                const isOnline = peerLastActivity[p.peerId] && Date.now() - peerLastActivity[p.peerId] < 3 * 60 * 1000;
                const hasUnread = unreadPeerIds[p.peerId];
                return (
                <div key={p.peerId} className="relative space-y-1">
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border-2 cursor-pointer text-left transition-colors ${
                      hasUnread
                        ? "border-orange-500 ring-2 ring-orange-400/60 bg-orange-500/15"
                        : p.peerId === activePeerId
                        ? "border-[var(--primary)]"
                        : "border-[var(--border)]"
                    } ${
                      p.peerId === activePeerId
                        ? "bg-[var(--primary)] text-white"
                        : hasUnread
                        ? ""
                        : "bg-[var(--card)] text-[var(--fg)] hover:bg-[var(--card-2)]"
                    }`}
                    onClick={() => {
                      setActivePeerId(p.peerId);
                      setSidebarOpen(false);
                    }}
                    title={p.peerId}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className="shrink-0 w-2.5 h-2.5 rounded-full"
                        title={isOnline ? "Đang hoạt động" : "Offline"}
                        aria-hidden
                        style={{ backgroundColor: isOnline ? "#22c55e" : "#ef4444" }}
                      />
                      {hasUnread ? (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white dark:ring-gray-800" title="Tin chưa đọc" aria-hidden />
                      ) : null}
                      <div className="min-w-0">
                        <div className="font-semibold leading-5 truncate">{p.alias}</div>
                        <div
                          className={`text-[11px] leading-4 truncate ${
                            p.peerId === activePeerId ? "text-white/70" : "text-[var(--muted)]"
                          }`}
                        >
                          {preview}
                        </div>
                      </div>
                    </div>
                    <span className="sr-only">Mở chat</span>
                  </button>
                  {confirmRemovePeerId === p.peerId ? (
                    <div className="rounded-xl border border-amber-500/80 bg-amber-500/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 flex items-center justify-between gap-2">
                      <span>Xóa kết nối? Lịch sử chat sẽ bị xóa.</span>
                      <span className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          className="px-2 py-1 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700"
                          onClick={(e) => { e.stopPropagation(); confirmRemovePeer(p.peerId); }}
                        >
                          Xác nhận
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-lg bg-white/80 dark:bg-black/30 text-amber-900 dark:text-amber-100 font-medium hover:bg-white dark:hover:bg-black/50"
                          onClick={(e) => { e.stopPropagation(); setConfirmRemovePeerId(null); }}
                        >
                          Hủy
                        </button>
                      </span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className={`shrink-0 cursor-pointer ${
                      p.peerId === activePeerId
                        ? "text-white/80 hover:text-white"
                        : "text-[var(--muted)] hover:text-red-500"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmRemovePeerId(p.peerId);
                    }}
                    title="Xóa khỏi danh sách (sẽ xóa lịch sử chat)"
                    style={{ position: "absolute", right: 12, top: 10 }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
              })}
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">
              Chưa có kết nối nào. Bấm “Kết nối mới” để thêm peer.
            </div>
          )}
        </div>
      </aside>

      {/* Chat area (right) */}
      <section className="flex-1 md:flex-7 min-w-0 min-h-0 flex flex-col rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 md:p-4">
        {/* Mobile header: menu, PI-Chat, theme, status, đăng xuất */}
        <div className="flex md:hidden items-center justify-between gap-2 pb-3 mb-2 border-b border-[var(--border)]">
          <button
            type="button"
            className="p-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--fg)] hover:bg-[var(--card)] cursor-pointer"
            onClick={() => setSidebarOpen(true)}
            title="Menu"
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-[var(--fg)] truncate">PI-Chat</h1>
          <button
            type="button"
            className="p-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--fg)] hover:bg-[var(--card)] cursor-pointer shrink-0"
            onClick={toggleTheme}
            title="Đổi giao diện sáng/tối"
            aria-label="Đổi theme"
          >
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium shrink-0 ${
              status === "connected"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : status === "connecting"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
            title={status}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                status === "connected"
                  ? "bg-green-500"
                  : status === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-slate-400"
              }`}
            />
            <span className="truncate max-w-[72px]">{userId || "—"}</span>
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--fg)] hover:bg-[var(--card)] cursor-pointer text-xs font-semibold shrink-0"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Đăng xuất"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="max-sm:hidden">Đăng xuất</span>
          </button>
        </div>

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

