import { useLocation, useNavigate } from "react-router-dom";

export default function TierStatusCard({ tier }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tierDisplay = {
    free: "🥉 Free Tier",
    pro: "🥈 Pro Tier",
    elite: "🥇 Elite Tier",
  };

  const colorClass = {
    free: "bg-base-200 text-gray-300 border border-gray-500",
    pro: "bg-purple-200 text-purple-800 border border-purple-400",
    elite: "bg-yellow-200 text-yellow-800 border border-yellow-400",
  };

  const handleClick = () => {
    if (location.pathname === "/upgrade") {
      const eliteSection = document.getElementById("elite-tier");
      if (eliteSection) {
        eliteSection.scrollIntoView({ behavior: "smooth", block: "start" });
        eliteSection.classList.add("ring", "ring-yellow-400", "ring-offset-2");
        setTimeout(() => {
          eliteSection.classList.remove("ring", "ring-yellow-400", "ring-offset-2");
        }, 2000);
      }
    } else {
      navigate("/upgrade#elite");
    }
  };

  return (
    <div
      className={`p-4 rounded-lg shadow cursor-pointer hover:opacity-90 transition ${colorClass[tier] || colorClass["free"]}`}
      onClick={handleClick}
    >
      <p className="text-center font-semibold">Account Status</p>
      <h3 className="text-xl text-center font-bold">{tierDisplay[tier] || "Unknown"}</h3>
      <p className="text-xs text-center mt-1 text-gray-500">Click to upgrade</p>
    </div>
  );
}