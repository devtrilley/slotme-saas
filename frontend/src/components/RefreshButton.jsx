import { showToast } from "../utils/toast";

export default function RefreshButton({
  onRefresh,
  label = "Refresh",
  toast = true,
  className = "",
}) {
  const handleClick = () => {
    if (toast) showToast("🔄 Refreshing...", "refresh", 2000);
    if (onRefresh) onRefresh();
  };

  return (
    <button
      onClick={handleClick}
      className={`btn btn-sm btn-outline ${className}`}
    >
      🔄 {label}
    </button>
  );
}
