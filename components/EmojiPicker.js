import dynamic from "next/dynamic";
import { useState } from "react";

// emoji-mart uses dynamic import to avoid SSR issues
const Picker = dynamic(
  () => import("emoji-mart").then((mod) => mod.Picker || mod.EmojiPicker),
  { ssr: false }
);

export default function EmojiPicker({ onSelect }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
        title="Chọn emoji"
      >
        <span className="text-xl">😊</span>
      </button>
      {open && (
        <div className="absolute bottom-10 left-0 z-20 bg-white rounded-2xl shadow-lg border border-slate-200">
          <Picker
            theme="auto"
            onEmojiSelect={(emoji) => {
              if (emoji && emoji.native && onSelect) {
                onSelect(emoji.native);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

