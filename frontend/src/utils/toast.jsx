import toast from "react-hot-toast";
import { useRef, useState, useEffect } from "react";

const iconMap = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  refresh: "🔄",
};

function getToastStyle(type = "default") {
  switch (type) {
    case "success":
      return { background: "#36D399", color: "#1F2937" };
    case "error":
      return { background: "#F87272", color: "#1F2937" };
    case "warning":
      return { background: "#FBBD23", color: "#1F2937" };
    case "info":
    case "refresh":
      return { background: "#3ABFF8", color: "#1F2937" };
    default:
      return { background: "#1F2937", color: "#fff" };
  }
}

function SwipeableToast({ message, type = "success", toastId }) {
  const ref = useRef(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [dismissType, setDismissType] = useState(null); // "swipe" | "manual" | "timeout"
  const [entered, setEntered] = useState(false);

  // ✅ Smooth entrance animation
  useEffect(() => {
    const enterTimer = setTimeout(() => {
      setEntered(true);
    }, 10);
    return () => clearTimeout(enterTimer);
  }, []);

  // 👆 Swipe support
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
    const handleTouchMove = (e) => {
      const deltaX = e.touches[0].clientX - touchStartX;
      setTranslateX(deltaX);
    };
    const handleTouchEnd = () => {
      if (Math.abs(translateX) > 80) {
        setDismissType("swipe");
        setDismissed(true);
        setTimeout(() => toast.dismiss(toastId), 300);
      } else {
        setTranslateX(0);
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [touchStartX, translateX, toastId]);

  // ⏱️ Timeout fade
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDismissType("timeout");
      setDismissed(true);
      setTimeout(() => toast.dismiss(toastId), 300);
    }, 6000);
    return () => clearTimeout(timeout);
  }, [toastId]);

  const handleClose = () => {
    setDismissType("manual");
    setDismissed(true);
    setTimeout(() => toast.dismiss(toastId), 300);
  };

  const isSwipe = dismissType === "swipe";

  const transform = dismissed
    ? isSwipe
      ? translateX > 0
        ? "translateX(100vw)"
        : "translateX(-100vw)"
      : "scale(0.9)"
    : translateX !== 0
    ? `translateX(${translateX}px)`
    : entered
    ? "translateY(0) scale(1)"
    : "translateY(-8px) scale(0.95)";

    const style = {
      ...getToastStyle(type),
      padding: "10px 16px",
      borderRadius: "6px",
      fontSize: "0.875rem",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      maxWidth: "90vw",
      justifyContent: "space-between",
      cursor: "default",
      transform,
      opacity: dismissed ? 0 : entered ? 1 : 0,
      transition: "transform 0.3s ease, opacity 0.3s ease",
      position: "relative",
      zIndex: 10000,
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    };

  const closeBtnStyle = {
    background: "transparent",
    border: "none",
    color: style.color,
    fontSize: "1rem",
    fontWeight: "bold",
    marginLeft: "auto",
    cursor: "pointer",
  };

  return (
    <div ref={ref} style={style}>
      <span>{iconMap[type] || "💬"}</span>
      <span>{message}</span>
      <button style={closeBtnStyle} onClick={handleClose}>
        ×
      </button>
    </div>
  );
}

// ✅ Toast trigger
export function showToast(message, type = "success", duration = 6000) {
  toast.custom(
    (t) => <SwipeableToast message={message} type={type} toastId={t.id} />,
    { duration }
  );
}
