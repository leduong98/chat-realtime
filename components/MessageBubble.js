import { Check, CheckCheck } from "lucide-react";

function Status({ status }) {
  if (!status || status === "sent") {
    return (
      <span className="inline-flex items-center gap-1">
        <Check className="h-3.5 w-3.5" />
        <span>Đã gửi</span>
      </span>
    );
  }
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1">
        <CheckCheck className="h-3.5 w-3.5" />
        <span>Đã nhận</span>
      </span>
    );
  }
  if (status === "seen") {
    return (
      <span className="inline-flex items-center gap-1">
        <CheckCheck className="h-3.5 w-3.5" />
        <span>Đã xem</span>
      </span>
    );
  }
  return null;
}

export default function MessageBubble({ isOwn, message, timestamp, kind, status }) {
  const isImage = kind === "image" || String(message || "").startsWith("data:image/");
  return (
    <div className={`flex mb-3 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isOwn
            ? "bg-[var(--primary)] text-white rounded-br-md"
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
        <div
          className={`mt-1 text-[10px] flex items-center justify-end gap-2 ${
            isOwn ? "text-white/80" : "text-[var(--muted)]"
          }`}
        >
          <span>{timestamp}</span>
          {isOwn ? <Status status={status} /> : null}
        </div>
      </div>
    </div>
  );
}
