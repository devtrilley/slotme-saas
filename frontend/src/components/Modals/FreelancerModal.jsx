import { FaCheck } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import ProfilePhoto from "../ProfilePhoto";

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
        <div className="flex justify-center mb-4">
          <ProfilePhoto
            src={freelancer.logo_url}
            tier={freelancer.tier}
            isVerified={freelancer.is_verified}
            size="w-24 h-24"
          />
        </div>

        {/* Name + Tagline */}
        <h2 className="text-xl font-bold text-center text-white">
          {freelancer.business_name ||
            `${freelancer.first_name} ${freelancer.last_name}`}
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
