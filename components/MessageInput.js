import { useEffect, useRef } from "react";

export default function MessageInput({
  value,
  onChange,
  onSend,
  onTyping,
  disabled,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      120
    )}px`;
  }, [value]);

  function handleKeyDown(e) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend();
      }
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-slate-200 pt-3 mt-3 bg-white rounded-2xl px-2 py-2">
      <div className="flex-1 flex items-end bg-slate-100 rounded-2xl px-4 py-2 min-h-[44px]">
        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-800 placeholder:text-slate-400"
          placeholder={disabled ? "Chưa kết nối..." : "Nhập tin nhắn..."}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            if (onTyping) onTyping();
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      <button
        type="button"
        className="px-5 py-2.5 rounded-2xl bg-[#22c55e] text-white text-sm font-semibold shadow-md shadow-green-200/50 hover:bg-[#16a34a] disabled:opacity-50 transition-all"
        onClick={onSend}
        disabled={disabled || !value.trim()}
      >
        Gửi
      </button>
    </div>
  );
}
