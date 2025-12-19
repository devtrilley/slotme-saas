// src/components/Modals/BaseModal.jsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function BaseModal({
  // content
  title,
  children,
  // behavior
  open = true,
  dismissible = true, // allow click-away + Esc?
  onClose, // called when user closes
  // visuals
  showCloseX = true, // show top-right X if dismissible
  className = "", // extra classes for the card
}) {
  const cardRef = useRef(null);

  // lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // focus the card on mount (a11y)
  useEffect(() => {
    if (open && cardRef.current) cardRef.current.focus();
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (e) => {
    e.stopPropagation();
    if (!dismissible) return;
    if (e.target === e.currentTarget && onClose) onClose();
  };

  const handleKeyDown = (e) => {
    if (!dismissible) return;
    if (e.key === "Escape") onClose?.();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      {/* Background overlay - this grays out everything */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />

      {/* modal card */}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={[
          "relative z-[101] w-[92%] max-w-sm rounded-xl",
          "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950",
          "shadow-2xl border border-slate-700 p-5 outline-none",
          className,
        ].join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {dismissible && showCloseX && (
          <button
            type="button"
            className="absolute top-2.5 right-3 text-xl text-gray-400 hover:text-white"
            aria-label="Close"
            onClick={() => onClose?.()}
          >
            &times;
          </button>
        )}

        {title ? (
          <h2 className="text-lg font-bold text-center">{title}</h2>
        ) : null}

        <div className="mt-4 max-h-[65vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );

  // 🎯 THIS IS THE KEY: Render at document.body level using React Portal
  return createPortal(modalContent, document.body);
}
