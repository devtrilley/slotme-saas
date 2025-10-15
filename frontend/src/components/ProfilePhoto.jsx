import { FaCheck } from "react-icons/fa";

export default function ProfilePhoto({
  src,
  tier = "free",
  size = "w-24 h-24",
  isVerified = false,
}) {
  const safeTier = typeof tier === "string" ? tier.toLowerCase() : "free";

  const glow =
    safeTier === "free"
      ? {
          border: "border-white/70",
          shadow: "shadow-[0_0_8px_2px_rgba(255,255,255,0.3)]",
        }
      : {
          border: "border-indigo-500",
          shadow: "shadow-[0_0_12px_4px_rgba(99,102,241,0.7)]",
        };

  // console.log("ProfilePhoto tier:", tier);
  // console.log("safeTier:", safeTier);
  return (
    <div className={`relative inline-block ${size}`}>
      <div
        className={`rounded-full border-2 ${glow.border} ${glow.shadow} w-full h-full`}
      >
        <img
          src={src?.trim() || "https://placehold.co/128x128?text=Logo"}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "https://placehold.co/128x128?text=Logo";
          }}
          alt="Freelancer"
          className="w-full h-full object-cover rounded-full"
        />
      </div>

      {isVerified && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center"
          title="Verified Freelancer"
        >
          <FaCheck className="text-white text-xs" />
        </div>
      )}
    </div>
  );
}
