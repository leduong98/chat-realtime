import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","😘","😎","🤔","😭",
  "👍","👎","🙏","👏","🔥","🎉","❤️","💔","✨","💯",
  "😅","😴","🤝","🙌","🤩","😡","🥳","🤗","😮","😬",
];

export default function EmojiPicker({ onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="p-2.5 rounded-xl bg-[var(--card-2)] text-[var(--fg)] hover:bg-[var(--card)] transition-colors disabled:opacity-50 border border-[var(--border)]"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Emoji"
      >
        <Smile className="h-5 w-5" />
      </button>
      {open ? (
        <div className="absolute bottom-12 left-0 z-20 w-[260px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl">
          <div className="grid grid-cols-10 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="h-9 w-9 rounded-xl hover:bg-[var(--card-2)] text-lg"
                onClick={() => {
                  if (onPick) onPick(e);
                }}
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

