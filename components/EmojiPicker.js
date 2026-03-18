import { useEffect, useRef, useState } from "react";

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
        className="p-2.5 rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Emoji"
      >
        😊
      </button>
      {open ? (
        <div className="absolute bottom-12 left-0 z-20 w-[260px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60">
          <div className="grid grid-cols-10 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="h-9 w-9 rounded-xl hover:bg-slate-100 text-lg"
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

