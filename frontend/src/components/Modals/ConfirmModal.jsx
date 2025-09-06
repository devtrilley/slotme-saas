import { useEffect } from "react";
import BaseModal from "./BaseModal";

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onDisable, // Optional
  title,
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  serviceCardElement,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <BaseModal
      open={isOpen}
      onClose={onClose}
      dismissible={true}
      showCloseX={true}
      className="max-w-xl"
    >
      <div className="space-y-6 text-center">
        {title && <h2 className="text-xl font-bold text-white">{title}</h2>}
        <p className="text-white text-lg font-medium">{message}</p>

        {serviceCardElement && (
          <div className="bg-white/5 border border-white/15 p-4 rounded-lg shadow-sm">
            {serviceCardElement}
          </div>
        )}

        <div className="flex justify-center gap-4 flex-wrap mt-2">
          {/* ✅ Confirm */}
          <button
            onClick={onConfirm}
            className="btn btn-error px-6 py-2 text-base font-semibold"
          >
            {confirmText}
          </button>

          {/* ✅ Conditionally show disable */}
          {onDisable && (
            <button
              onClick={onDisable}
              className="btn btn-warning px-6 py-2 text-base font-semibold"
            >
              Disable Instead
            </button>
          )}

          {/* ✅ Cancel / Keep */}
          <button
            onClick={onClose}
            className="bg-primary text-white px-6 py-2 text-base font-semibold rounded-lg hover:bg-purple-700 transition"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
