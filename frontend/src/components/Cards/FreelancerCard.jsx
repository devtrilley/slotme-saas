import { useState, useRef, useEffect } from "react";
import { FaCheck } from "react-icons/fa";
import FallbackText from "../Layout/FallbackText";
import ProfilePhoto from "../ProfilePhoto";

export default function FreelancerCard({
  business_name,
  first_name,
  last_name,
  logoUrl,
  isVerified,
  tagline,
  onClick = () => {},
  tier = "free",
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  const badgeRef = useRef();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target)) {
        setTooltipVisible(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const isUpgradedTier = tier !== "free";

  return (
    <div
      className={`rounded-xl p-[2px] ${
        isUpgradedTier
          ? "bg-gradient-to-r from-purple-500 to-indigo-500"
          : "border-2 border-white/40"
      }`}
    >
      <div
        className="flex items-center gap-4 p-4 rounded-[10px] shadow bg-base-200 cursor-pointer"
        onClick={onClick}
      >
        <div className="relative">
          <ProfilePhoto src={logoUrl} tier={tier} size="w-17 h-17" />

          {isVerified && (
            <div
              ref={badgeRef}
              className="absolute bottom-0 right-0 z-10 translate-x-1 translate-y-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (!isMobile) return;
                setTooltipVisible((prev) => !prev);
              }}
              onMouseEnter={() => !isMobile && setTooltipVisible(true)}
              onMouseLeave={() => !isMobile && setTooltipVisible(false)}
            >
              <div className="w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
                <FaCheck className="text-white text-xs" />
              </div>

              {tooltipVisible && (
                <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                  Verified Freelancer
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1">
          <FallbackText
            value={
              business_name?.trim() ||
              `${first_name?.trim() || ""} ${last_name?.trim() || ""}`.trim()
            }
            fallback="Your Business Name"
            className="text-white font-bold text-lg"
          />

          <FallbackText
            value={tagline}
            fallback="Add a tagline to describe your services"
            className="text-sm italic text-gray-300 mt-1"
          />
        </div>
      </div>
    </div>
  );
}
