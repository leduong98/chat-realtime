import { useEffect, useRef } from "react";
import EmojiPicker from "./EmojiPicker";
import { Image as ImageIcon, SendHorizonal } from "lucide-react";

export default function MessageInput({
  value,
  onChange,
  onSend,
  onTyping,
  onSendImage,
  disabled,
}) {
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

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
    <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3 mt-3 bg-[var(--card)] rounded-2xl px-2 py-2">
      <button
        type="button"
        className="h-11 w-11 inline-flex items-center justify-center rounded-xl bg-[var(--card-2)] text-[var(--fg)] hover:bg-[var(--card)] transition-colors disabled:opacity-50 border border-[var(--border)] cursor-pointer"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        title="Gửi ảnh (base64)"
      >
        <ImageIcon className="h-5 w-5" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const maxSize = 300 * 1024; // ~300KB để tránh payload quá lớn
          if (file.size > maxSize) {
            alert("Ảnh quá lớn. Hãy chọn ảnh nhỏ hơn ~300KB.");
            e.target.value = "";
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (onSendImage) onSendImage(String(reader.result || ""));
            e.target.value = "";
          };
          reader.readAsDataURL(file);
        }}
      />
      <div className="flex-1 flex items-center bg-[var(--card-2)] rounded-2xl px-4 min-h-11 border border-[var(--border)]">
        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm leading-5 text-[var(--fg)] placeholder:text-[var(--muted)] py-3"
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
      <EmojiPicker
        disabled={disabled}
        onPick={(emoji) => {
          onChange((value || "") + emoji);
          if (onTyping) onTyping();
        }}
      />
      <button
        type="button"
        className="h-11 inline-flex items-center justify-center gap-2 px-4 rounded-2xl bg-[var(--primary)] text-white text-sm font-semibold shadow-sm hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors cursor-pointer"
        onClick={onSend}
        disabled={disabled || !value.trim()}
      >
        <SendHorizonal className="h-4 w-4" />
        Gửi
      </button>
    </div>
  );
}
