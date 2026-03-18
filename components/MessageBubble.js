export default function MessageBubble({ isOwn, message, timestamp, kind }) {
  const isImage = kind === "image" || String(message || "").startsWith("data:image/");
  return (
    <div className={`flex mb-3 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isOwn
            ? "bg-[#22c55e] text-white rounded-br-md"
            : "bg-[var(--card)] text-[var(--fg)] border border-[var(--border)] rounded-bl-md"
        }`}
      >
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
              }`}
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
        <div className={`mt-1 text-[10px] text-right ${isOwn ? "text-white/80" : "text-[var(--muted)]"}`}>
          {timestamp}
        </div>
      </div>
    </div>
  );
}
