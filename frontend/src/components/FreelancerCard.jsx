import { useState, useRef, useEffect } from "react";
import { FaCheck } from "react-icons/fa";

export default function FreelancerCard({
  name,
  logoUrl,
  isVerified,
  tagline,
  onClick = () => {},
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const badgeRef = useRef();

  // Close tooltip on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target)) {
        setTooltipVisible(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div
      className="flex items-center gap-4 p-4 border rounded shadow bg-base-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="relative w-17 h-17">
        <img
          src={logoUrl?.trim() ? logoUrl : "https://placehold.co/64x64?text=Logo"}
          alt="Freelancer Logo"
          className="w-17 h-17 rounded-full object-cover border-1 border-white" // ✅ white border
        />
        {isVerified && (
          <div
            ref={badgeRef}
            className="absolute bottom-0 right-0 z-10 translate-x-1 translate-y-0"
            onClick={(e) => {
              e.stopPropagation(); // ✅ Prevent card click
              setTooltipVisible((prev) => !prev);
            }}
          >
            <div className="w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
              <FaCheck className="text-white text-xs" />
            </div>
            {tooltipVisible && (
              <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                Verified Freelancer
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1">
        <p className="font-bold text-lg leading-tight">{name}</p>
        {tagline && <p className="text-sm text-gray-400">{tagline}</p>}
      </div>
    </div>
  );
}