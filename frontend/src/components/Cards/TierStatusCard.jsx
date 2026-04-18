import { useLocation, useNavigate } from "react-router-dom";
import FallbackText from "../Layout/FallbackText";

export default function TierStatusCard({
  tier,
  error = false,
  notLoggedIn = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const tierDisplay = {
    free: "🥉 Free Tier",
    pro: "🥇 Pro Tier",
  };

  const colorClass = {
    free: "bg-base-200 text-gray-300 border-2 border-white/40",
    pro: "metallic-pro",
    error: "bg-red-100 text-red-700 border border-red-300",
    loggedOut: "bg-base-200 text-gray-500 border border-dashed border-gray-500",
  };

  const handleClick = () => {
    if (notLoggedIn || error) return;

    if (location.pathname === "/upgrade") {
      const proSection = document.getElementById("pro-tier");
      if (proSection) {
        proSection.scrollIntoView({ behavior: "smooth", block: "start" });
        proSection.classList.add("ring", "ring-purple-400", "ring-offset-2");
        setTimeout(() => {
          proSection.classList.remove(
            "ring",
            "ring-purple-400",
            "ring-offset-2"
          );
        }, 2000);
      }
    } else {
      navigate("/upgrade#pro");
    }
  };

  const getDisplayText = () => {
    if (notLoggedIn) return "Not signed in";
    if (error) return "Unknown";
    return tierDisplay[tier] || "Free Tier";
  };

  const cardColor = notLoggedIn
    ? colorClass.loggedOut
    : error
    ? colorClass.error
    : colorClass[tier] || colorClass.free;

  return (
    <div
      className={`p-4 rounded-xl shadow transition ${cardColor} ${
        !notLoggedIn && !error ? "cursor-pointer hover:opacity-90" : ""
      }`}
      onClick={handleClick}
    >
      <p className="text-center font-semibold">Account Status</p>
      <p className="text-xl text-center font-bold">{getDisplayText()}</p>
      <p className="text-xs text-center mt-1 text-gray-500 italic">
        {notLoggedIn
          ? "Log in to see your tier"
          : error
          ? "Unable to verify status."
          : "Click to upgrade"}
      </p>
    </div>
  );
}
