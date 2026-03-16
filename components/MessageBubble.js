export default function MessageBubble({ isOwn, message, timestamp, isImage }) {
  return (
    <div className={`flex mb-3 ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isOwn
            ? "bg-[#22c55e] text-white rounded-br-md"
            : "bg-[#fef08a]/90 text-slate-800 border border-amber-200/60 rounded-bl-md"
        }`}
      >
        {isImage ? (
          <img
            src={message}
            alt="sent attachment"
            className="max-w-[180px] max-h-[180px] rounded-lg mb-1"
          />
        ) : (
          <span className="whitespace-pre-wrap break-words">{message}</span>
        )}
        <div className={`mt-1 text-[10px] text-right ${isOwn ? "text-white/80" : "text-slate-500"}`}>
          {timestamp}
        </div>
      </div>
    </div>
  );
}
