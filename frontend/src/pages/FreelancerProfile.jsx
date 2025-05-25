import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { FaCheck } from "react-icons/fa";

export default function FreelancerProfile() {
  const { freelancerId } = useParams();
  const [freelancer, setFreelancer] = useState(null);
  const [error, setError] = useState("");
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const badgeRef = useRef();

  useEffect(() => {
    axios
      .get(`http://127.0.0.1:5000/freelancers/${freelancerId}`)
      .then((res) => setFreelancer(res.data))
      .catch((err) => {
        console.error("❌ Failed to load freelancer profile", err);
        setError("Freelancer not found or unavailable.");
      });
  }, [freelancerId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target)) {
        setTooltipVisible(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (error) return <p className="text-center text-red-500">{error}</p>;
  if (!freelancer) return <p className="text-center">Loading...</p>;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      {/* Logo + badge */}
      <div className="relative inline-block w-32 h-32">
        <img
          src={freelancer.logo_url || "https://placehold.co/128x128?text=Logo"}
          alt="Freelancer Logo"
          className="w-32 h-32 rounded-full object-cover border-2 border-white"
          style={{ boxShadow: "0 0 12px rgba(255,255,255,0.5)" }}
        />
        {freelancer.is_verified && (
          <div
            ref={badgeRef}
            className="absolute bottom-0 right-0 z-10 translate-x-0 -translate-y-1"
            onClick={(e) => {
              e.stopPropagation();
              setTooltipVisible((prev) => !prev);
            }}
          >
            <div className="w-7 h-7 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
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

      {/* Tagline */}
      {freelancer.tagline && (
        <p className="text-sm italic text-gray-300 -mt-3">“{freelancer.tagline}”</p>
      )}

      {/* Name and bullets */}
      <div>
        <h1 className="text-2xl font-bold">{freelancer.name}</h1>
        <ul className="mt-4 text-left text-sm space-y-2">
          {freelancer.bio && (
            <li className="italic text-gray-300">
              <strong className="not-italic text-white">Bio:</strong> {freelancer.bio}
            </li>
          )}
          {freelancer.timezone && (
            <li>
              <strong>Timezone:</strong> {freelancer.timezone}
            </li>
          )}
        </ul>
      </div>

      {/* Join date (hardcoded for now) */}
      <p className="text-xs text-gray-400">Joined May 25, 2025</p>

      <Link to={`/book/${freelancer.id}`} className="btn btn-primary mt-4">
        Click Here to Book Me!
      </Link>
    </div>
  );
}