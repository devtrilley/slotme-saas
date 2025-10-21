import { useState } from "react";

function SafetyTip() {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-yellow-900/20 px-4 py-2 text-sm hover:bg-yellow-900/30 transition-colors"
      >
        <span className="text-base leading-none">💡</span>
        <span className="font-medium text-yellow-300">
          Have active bookings?
        </span>
        <span className="opacity-70">Tap to expand</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-500/40 bg-yellow-900/20 p-4 text-sm text-left">
      <div className="flex items-start gap-3">
        <div className="text-lg leading-none">💡</div>
        <div className="flex-1">
          <p className="font-medium text-yellow-300 mb-2">Before you proceed</p>
          <p className="text-white/90 leading-relaxed">
            If you have active customers or ongoing bookings, you may want to
            export that information first. None of your data will be retained
            after deletion, and creating a new account will start from scratch.
          </p>
          <button
            className="mt-3 text-xs opacity-70 hover:opacity-100 underline"
            onClick={() => setExpanded(false)}
          >
            Collapse
          </button>
        </div>
      </div>
    </div>
  );
}

export default SafetyTip;
