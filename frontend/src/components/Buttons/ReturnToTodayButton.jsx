import React from "react";

export default function ReturnToTodayButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-5 py-2.5 rounded-full font-semibold text-sm
        text-white transition-all duration-200 active:scale-95

        /* 🔥 SAME POP STYLE AS REFRESH */
        bg-gradient-to-b from-slate-700 to-slate-900
        border border-slate-500/60
        shadow-[0_0_8px_rgba(0,0,0,0.35)]
        
        /* 🔥 SAME HOVER = SLOTME PURPLE */
        hover:from-purple-500 hover:to-purple-600
        hover:border-purple-400
        hover:shadow-[0_0_12px_rgba(168,85,247,0.55)]

        ${className}
      `}
    >
      ⏮️ Return to Today
    </button>
  );
}