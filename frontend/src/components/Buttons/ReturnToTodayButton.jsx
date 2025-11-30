import React from "react";

export default function ReturnToTodayButton({ onClick, className = "" }) {
  return (
    <button
      type="button" // 🔥 FIX: Prevent form submission
      onClick={onClick}
      className={`btn btn-xs btn-outline mt-2 p-4 ${className}`}
    >
      ⏮️ Return to Today
    </button>
  );
}