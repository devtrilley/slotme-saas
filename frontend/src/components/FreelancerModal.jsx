import { FaCheck } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

export default function FreelancerModal({ freelancer, onClose }) {
  const tooltipRef = useRef();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  if (!freelancer) return null;

  // Prevent scroll bleed while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // Clicking backdrop closes modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div className="bg-base-200 p-6 rounded-xl shadow-xl w-11/12 max-w-sm max-h-[90vh] overflow-y-auto relative mx-4 my-10">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-white text-2xl"
        >
          &times;
        </button>

        {/* Logo + Badge */}
        <div className="relative w-24 h-24 mx-auto mb-4 group">
          <img
            src={freelancer.logo_url || "https://placehold.co/96x96?text=Logo"}
            alt="Freelancer Logo"
            className="w-24 h-24 rounded-full object-cover border border-white shadow-lg"
          />
          {freelancer.is_verified && (
            <div
              className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center group-hover:tooltip-visible"
              ref={tooltipRef}
              onMouseEnter={() => setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
              onTouchStart={() => setTooltipVisible((prev) => !prev)}
            >
              <FaCheck className="text-white text-xs" />
              {tooltipVisible && (
                <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                  Verified Freelancer
                </div>
              )}
            </div>
          )}
        </div>

        {/* Name + Tagline */}
        <h2 className="text-xl font-bold text-center text-white">
          {freelancer.name}
        </h2>
        {freelancer.tagline && (
          <p className="italic text-sm text-gray-400 text-center mt-1">
            “{freelancer.tagline}”
          </p>
        )}

        {/* Bio */}
        {freelancer.bio && (
          <p className="text-sm text-gray-200 mt-4">
            <strong>Bio:</strong> {freelancer.bio}
          </p>
        )}

        {/* Profile Button */}
        <Link
          to={`/freelancers/${freelancer.id}`}
          className="btn btn-primary mt-6 w-full"
          onClick={onClose}
        >
          Visit Profile
        </Link>
      </div>
    </div>
  );
}