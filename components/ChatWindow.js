"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { formatTime, formatChatAddress, parseChatAddress } from "../lib/utils";
import {
  loadMessages,
  saveMessage,
  getOrCreateUserId,
  getUsername,
  saveUsername,
} from "../lib/storage";
import {
  connectSignaling,
  onSignalMessage,
  sendSignal,
} from "../lib/signaling";
import {
  createPeerConnection,
  createOffer,
  handleOffer,
  handleAnswer,
  addIceCandidate,
} from "../lib/webrtc";
import { v4 as uuidv4 } from "uuid";

export default function ChatWindow() {
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [peerAddress, setPeerAddress] = useState("");
  const [status, setStatus] = useState("disconnected"); // connecting | connected | disconnected
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const peerIdRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const peerTypingTimeoutRef = useRef(null);

  // Notifications
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const id = getOrCreateUserId();
    setUserId(id);

    let storedName = getUsername();
    if (!storedName) {
      storedName = window.prompt("Nhập username của bạn") || "";
      if (!storedName.trim()) {
        storedName = `guest-${id.slice(0, 6)}`;
      }
      saveUsername(storedName);
    }
    setUsername(storedName);

    const history = loadMessages();
    setMessages(history);

    if (id) {
      connectSignaling(id, { username: storedName });
      const unsubscribe = onSignalMessage(async (msg) => {
        if (!pcRef.current) {
          await setupPeer(false);
        }
        if (!pcRef.current) return;

        if (msg.type === "offer") {
          peerIdRef.current = msg.fromId;
          setStatus("connecting");
          const answer = await handleOffer(pcRef.current, msg.offer);
          sendSignal({
            type: "answer",
            targetId: msg.fromId,
            answer,
          });
        } else if (msg.type === "answer") {
          await handleAnswer(pcRef.current, msg.answer);
        } else if (msg.type === "ice-candidate" && msg.candidate) {
          await addIceCandidate(pcRef.current, msg.candidate);
        } else if (msg.type === "typing") {
          setPeerTyping(true);
          if (peerTypingTimeoutRef.current) {
            clearTimeout(peerTypingTimeoutRef.current);
          }
          peerTypingTimeoutRef.current = setTimeout(
            () => setPeerTyping(false),
            1500
          );
        } else if (msg.type === "peer-unavailable") {
          setStatus("disconnected");
          alert("Peer không online hoặc chưa mở trang chat.");
        }
      });
      return () => {
        unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

  async function setupPeer(isInitiator) {
    if (pcRef.current) return;
    setStatus("connecting");

    const pc = createPeerConnection({
      onDataChannel: (channel) => {
        setupDataChannel(channel);
      },
      onIceCandidate: (candidate) => {
        if (peerIdRef.current) {
          sendSignal({
            type: "ice-candidate",
            targetId: peerIdRef.current,
            candidate,
          });
        }
      },
      onConnectionStateChange: (state) => {
        if (state === "connected") {
          setStatus("connected");
        } else if (state === "disconnected" || state === "failed") {
          setStatus("disconnected");
        }
      },
    });

    pcRef.current = pc;

    if (isInitiator) {
      const { offer, channel } = await createOffer(pc);
      setupDataChannel(channel);
      sendSignal({
        type: "offer",
        targetId: peerIdRef.current,
        offer,
      });
    }
  }

  function setupDataChannel(channel) {
    channelRef.current = channel;
    channel.onopen = () => {
      setStatus("connected");
    };
    channel.onclose = () => {
      setStatus("disconnected");
    };
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "typing") {
          setPeerTyping(true);
          if (peerTypingTimeoutRef.current) {
            clearTimeout(peerTypingTimeoutRef.current);
          }
          peerTypingTimeoutRef.current = setTimeout(
            () => setPeerTyping(false),
            1500
          );
        } else if (data.type === "message") {
          const msg = {
            id: uuidv4(),
            chatId: peerIdRef.current,
            senderId: data.senderId,
            message: data.message,
            isImage: data.isImage || false,
            timestamp: data.timestamp,
          };
          setMessages((prev) => [...prev, msg]);
          saveMessage(msg);
          showNotification(msg);
        }
      } catch {
        // ignore
      }
    };
  }

  function showNotification(msg) {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden) return;
    const body = msg.isImage ? "[Ảnh]" : msg.message;
    new Notification("Tin nhắn mới", {
      body,
    });
  }

  async function handleConnect() {
    if (!peerAddress.trim()) return;
    const parsed = parseChatAddress(peerAddress);
    if (!parsed) return;
    peerIdRef.current = parsed;
    await setupPeer(true);
  }

  function handleSendMessageInternal({ text, isImage }) {
    if (!channelRef.current || channelRef.current.readyState !== "open") {
      alert("Chưa kết nối WebRTC, hãy kiểm tra lại peer.");
      return;
    }
    const payload = {
      type: "message",
      senderId: userId,
      message: text,
      isImage: !!isImage,
      timestamp: Date.now(),
    };
    channelRef.current.send(JSON.stringify(payload));
    const msg = {
      id: uuidv4(),
      chatId: peerIdRef.current,
      senderId: userId,
      message: text,
      isImage: !!isImage,
      timestamp: payload.timestamp,
    };
    setMessages((prev) => [...prev, msg]);
    saveMessage(msg);
  }

  function handleSendText() {
    const text = typeof input === "string" ? input : "";
    const trimmed = text.trim();
    if (!trimmed) return;
    handleSendMessageInternal({ text: trimmed, isImage: false });
    setInput("");
  }

  function handleSendImage(dataUrl) {
    handleSendMessageInternal({ text: dataUrl, isImage: true });
  }

  function handleTyping() {
    setTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 1500);

    if (channelRef.current && channelRef.current.readyState === "open") {
      channelRef.current.send(JSON.stringify({ type: "typing" }));
    }

    if (peerIdRef.current) {
      sendSignal({
        type: "typing",
        targetId: peerIdRef.current,
      });
    }
  }

  const address = formatChatAddress(username || userId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-lg">
            👤
          </div>
          <div>
            <div className="text-xs text-slate-500">Bạn đang đăng nhập</div>
            <div className="font-semibold text-slate-800">{username}</div>
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
            <span className={`w-2 h-2 rounded-full ${
              status === "connected" ? "bg-green-500" : status === "connecting" ? "bg-amber-500 animate-pulse" : "bg-slate-400"
            }`} />
            {status}
          </span>
          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
            onClick={() => {
              navigator.clipboard
                .writeText(address)
                .then(() => alert("Đã copy địa chỉ!"))
                .catch(() => alert("Không copy được, hãy copy thủ công."));
            }}
          >
            📋 Copy địa chỉ
          </button>
        </div>
      </header>

      {/* Connect */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
          placeholder="Dán địa chỉ peer, ví dụ: chat://username#1234"
          value={peerAddress}
          onChange={(e) => setPeerAddress(e.target.value)}
        />
        <button
          type="button"
          className="px-5 py-2.5 rounded-2xl bg-[#22c55e] text-white text-sm font-semibold shadow-md shadow-green-200/50 hover:bg-[#16a34a] transition-all"
          onClick={handleConnect}
        >
          Kết nối
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 bg-white/50 rounded-2xl p-3 min-h-0" id="chat-scroll">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            isOwn={m.senderId === userId}
            message={m.message}
            isImage={m.isImage}
            timestamp={formatTime(m.timestamp)}
          />
        ))}
        {peerTyping && (
          <div className="text-xs text-amber-600 italic mb-2 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Đang nhập...
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput
        value={input}
        onChange={setInput}
        onSend={handleSendText}
        onTyping={handleTyping}
        onSendImage={handleSendImage}
        disabled={status !== "connected" && status !== "connecting"}
      />
    </div>
  );
}

