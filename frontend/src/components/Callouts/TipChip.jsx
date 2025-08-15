import { useEffect, useState } from "react";

const KEY = "admin_tip_hidden_v1";

export default function TipChip({ className = "" }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    setHidden(saved === "1");
  }, []);

  if (hidden) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-base-200/70 px-3 py-1.5 text-xs shadow-sm hover:bg-base-200 ${className}`}
      >
        <span className="text-base leading-none">💡</span>
        <span className="font-medium">Quick tip</span>
        <span className="opacity-70">Tap to expand</span>
      </button>
    );
  }

  return (
    <div className={`rounded-xl border border-white/20 bg-base-200/70 p-3 md:p-4 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className="text-xl leading-none">💡</div>
        <div className="text-sm leading-relaxed">
          <p className="font-medium">Quick tip</p>
          <p className="mt-0.5">
            Tap any section header below to expand it. Tap it again to collapse.
            Each section controls part of your account (links, slots, services, branding).
          </p>

          <div className="mt-3 flex gap-2">
            <button
              className="btn btn-xs"
              onClick={() => setOpen(false)}
              title="Collapse tip"
            >
              Collapse
            </button>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => {
                localStorage.setItem(KEY, "1");
                setHidden(true);
              }}
              title="Hide this tip permanently"
            >
              Don’t show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}