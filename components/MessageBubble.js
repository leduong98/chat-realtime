import { useEffect, useRef, useState } from "react";

const REACTS = ["😀", "😭", "👍", "👎", "😂"];

function buildCounts(reactions) {
  const by = reactions && typeof reactions === "object" ? reactions : {};
  const counts = {};
  for (const uid of Object.keys(by)) {
    const e = by[uid];
    if (!e) continue;
    counts[e] = (counts[e] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export default function MessageBubble(props) {
  const {
    isOwn,
    message,
    timestamp,
    kind,
    replyTo,
    reactions,
    showActions,
    onActionVisibilityChange,
    onReply,
    onReact,
  } = props;

  const isImage = kind === "image" || String(message || "").startsWith("data:image/");
  const [hovered, setHovered] = useState(false);
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!hovered) {
      setArmed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => setArmed(true), 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hovered]);

  const actionsVisible = Boolean(!isOwn && hovered && armed && showActions);

  useEffect(() => {
    if (onActionVisibilityChange) onActionVisibilityChange(actionsVisible);
  }, [actionsVisible, onActionVisibilityChange]);

  const reactionCounts = buildCounts(reactions);

  return (
    <div className={`flex mb-3 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[85%]">
        {!isOwn ? (
          <div
            className="absolute -top-10 left-0 z-10"
            style={{ display: actionsVisible ? "block" : "none" }}
          >
            <div className="inline-flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg px-1.5 py-1">
              <button
                type="button"
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--card-2)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--card)] cursor-pointer"
                onClick={onReply}
                title="Trả lời"
              >
                Reply
              </button>
              <div className="w-px h-6 bg-[var(--border)] mx-0.5" />
              {REACTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="h-8 w-8 rounded-xl hover:bg-[var(--card-2)] text-base cursor-pointer"
                  onClick={() => (onReact ? onReact(e) : null)}
                  title={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
            isOwn
              ? "bg-[var(--primary)] text-white rounded-br-md"
              : "bg-[var(--card)] text-[var(--fg)] border border-[var(--border)] rounded-bl-md"
          }`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {replyTo ? (
            <div
              className={`mb-2 rounded-xl px-3 py-2 text-xs border ${
                isOwn
                  ? "bg-white/10 border-white/20 text-white/90"
                  : "bg-[var(--card-2)] border-[var(--border)] text-[var(--muted)]"
              }`}
              title={replyTo.preview || ""}
            >
              {replyTo.preview || "Tin nhắn"}
            </div>
          ) : null}

          {isImage ? (
            <div className="space-y-2">
              <img
                src={message}
                alt="image"
                className="max-w-[240px] max-h-[240px] rounded-xl border border-black/10"
              />
              <button
                type="button"
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border ${
                  isOwn
                    ? "bg-white/15 text-white border-white/30 hover:bg-white/20"
                    : "bg-[var(--card-2)] text-[var(--fg)] border-[var(--border)] hover:opacity-90"
                } cursor-pointer`}
                onClick={() => {
                  navigator.clipboard
                    .writeText(String(message))
                    .then(() => alert("Đã copy base64 của ảnh."))
                    .catch(() => alert("Không copy được, hãy copy thủ công."));
                }}
              >
                Copy base64
              </button>
            </div>
          ) : (
            <span className="whitespace-pre-wrap wrap-break-word">{message}</span>
          )}

          <div
            className={`mt-1 text-[10px] text-right ${
              isOwn ? "text-white/80" : "text-[var(--muted)]"
            }`}
          >
            {timestamp}
          </div>

          {reactionCounts.length ? (
            <div className={`mt-2 flex flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
              {reactionCounts.map(([e, n]) => (
                <span
                  key={e}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs border ${
                    isOwn
                      ? "bg-white/10 border-white/20 text-white/90"
                      : "bg-[var(--card-2)] border-[var(--border)] text-[var(--fg)]"
                  }`}
                >
                  <span>{e}</span>
                  <span className={isOwn ? "text-white/70" : "text-[var(--muted)]"}>{n}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
