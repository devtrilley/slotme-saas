import { useState, useRef } from "react";
import { showToast } from "../utils/toast";

export default function RefreshButton({
  onRefresh,
  toast = true,
  toastMessage = "🔄 Refreshing data...",
  className = "",
}) {
  const [clicked, setClicked] = useState(false);

  const handleClick = async () => {
    // Save scroll position
    const scrollY = window.scrollY;

    setClicked(true);
    await onRefresh?.();
    setTimeout(() => setClicked(false), 300);

    // Restore scroll
    window.scrollTo({ top: scrollY, behavior: "auto" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`transition-all duration-200 ease-in-out px-4 py-2 rounded-md font-semibold text-sm
        border border-white text-white bg-transparent
        hover:bg-[#3ABFF8] hover:text-black hover:border-[#3ABFF8]
        active:scale-95 focus:outline-none
        ${className}
      `}
    >
      🔄 Refresh
    </button>
  );
}
