import React from "react";

const VARIANT_STYLES = {
  error: {
    border: "border-red-500",
    text: "text-red-500",
    icon: "❌",
  },
  warning: {
    border: "border-yellow-500",
    text: "text-yellow-600",
    icon: "⚠️",
  },
  info: {
    border: "border-blue-500",
    text: "text-blue-500",
    icon: "ℹ️",
  },
};

export default function ErrorCard({
  title,
  message,
  onRetry,
  variant = "error", // 🔧 default to 'error'
  icon, // optional override
}) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.error;
  const displayIcon = icon || styles.icon;

  return (
    <div
      className={`p-4 bg-base-100 border ${styles.border} rounded-lg text-center space-y-2`}
    >
      <p className={`font-semibold ${styles.text}`}>
        {displayIcon} {title}
      </p>
      <p className="text-sm text-gray-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm btn-outline">
          🔁 Retry
        </button>
      )}
    </div>
  );
}
