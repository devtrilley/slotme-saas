import React from "react";

export default function ReturnToTodayButton({ onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`btn btn-xs btn-outline mt-2 ${className}`}
    >
      ⏮️ Return to Today
    </button>
  );
}
