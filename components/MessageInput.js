import { useEffect, useRef } from "react";
import EmojiPicker from "./EmojiPicker";
import { Image as ImageIcon, SendHorizonal } from "lucide-react";

// Giới hạn kích thước ảnh (có thể tăng để chất lượng cao hơn; cân nhắc dung lượng MongoDB/network)
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB

function processImageFile(file, onSuccess, onError) {
  if (!file || !file.type.startsWith("image/")) return;
  if (file.size > MAX_IMAGE_BYTES) {
    onError?.(`Ảnh quá lớn. Tối đa ${Math.round(MAX_IMAGE_BYTES / 1024)}KB.`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (dataUrl) onSuccess?.(String(dataUrl));
  };
  reader.onerror = () => onError?.("Không đọc được ảnh.");
  reader.readAsDataURL(file);
}

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

  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processImageFile(file, onSendImage, (msg) => alert(msg));
        }
        return;
      }
    }
  }

  return (
    <div
      className="flex items-center gap-2 border-t border-[var(--border)] pt-3 mt-3 bg-[var(--card)] rounded-2xl px-2 py-2 min-w-0 overflow-x-hidden overflow-y-visible shrink-0"
      onPaste={handlePaste}
    >
      <button
        type="button"
        className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl bg-[var(--card-2)] text-[var(--fg)] hover:bg-[var(--card)] transition-colors disabled:opacity-50 border border-[var(--border)] cursor-pointer"
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
          processImageFile(
            file,
            (dataUrl) => {
              if (onSendImage) onSendImage(dataUrl);
              e.target.value = "";
            },
            (msg) => {
              alert(msg);
              e.target.value = "";
            }
          );
        }}
      />
      <div className="flex-1 min-w-0 flex items-center bg-[var(--card-2)] rounded-2xl px-4 min-h-11 border border-[var(--border)]">
        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-1 min-w-0 bg-transparent resize-none outline-none text-sm leading-5 text-[var(--fg)] placeholder:text-[var(--muted)] py-3"
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
      <span className="shrink-0">
        <EmojiPicker
          disabled={disabled}
          onPick={(emoji) => {
            onChange((value || "") + emoji);
            if (onTyping) onTyping();
          }}
        />
      </span>
      <button
        type="button"
        className="h-11 shrink-0 inline-flex items-center justify-center gap-2 px-3 sm:px-4 rounded-2xl bg-[var(--primary)] text-white text-sm font-semibold shadow-sm hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors cursor-pointer"
        onClick={onSend}
        disabled={disabled || !value.trim()}
      >
        <SendHorizonal className="h-4 w-4" />
        Gửi
      </button>
    </div>
  );
}
