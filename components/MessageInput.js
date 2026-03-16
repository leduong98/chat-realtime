import { useRef } from "react";
import EmojiPicker from "./EmojiPicker";

export default function MessageInput({
  value,
  onChange,
  onSend,
  onTyping,
  onSendImage,
  disabled,
}) {
  const fileRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend();
      }
    }
  }

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const maxSize = 150 * 1024;
    if (file.size > maxSize) {
      alert("Ảnh quá lớn, hãy chọn ảnh nhỏ hơn ~150KB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (onSendImage) onSendImage(reader.result);
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-end gap-2 border-t border-slate-200 pt-3 mt-3 bg-white rounded-2xl px-2 py-2">
      <button
        type="button"
        className="p-2.5 rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        title="Gửi ảnh"
      >
        <span className="text-lg">📎</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex-1 flex items-end bg-slate-100 rounded-2xl px-4 py-2 min-h-[44px]">
        <textarea
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-800 placeholder:text-slate-400"
          placeholder={disabled ? "Đang kết nối..." : "Nhập tin nhắn..."}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            if (onTyping) onTyping();
          }}
          onKeyDown={handleKeyDown}
        />
        <EmojiPicker
          onSelect={(emoji) => {
            onChange((value || "") + emoji);
            if (onTyping) onTyping();
          }}
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
