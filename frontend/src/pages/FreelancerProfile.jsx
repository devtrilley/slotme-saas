import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { FaCheck } from "react-icons/fa";
import ServiceCard from "../components/ServiceCard";
import NoShowPolicy from "../components/NoShowPolicy";
import FAQCard from "../components/FAQCard";
import { DateTime } from "luxon";
import { API_BASE } from "../utils/constants";

import { useFreelancer } from "../context/FreelancerContext";

const mapTimeZone = (tz) => {
  const zones = {
    "America/New_York": "Eastern Standard Time (EST)",
    "America/Chicago": "Central Standard Time (CST)",
    "America/Denver": "Mountain Standard Time (MST)",
    "America/Los_Angeles": "Pacific Standard Time (PST)",
  };
  return zones[tz] || tz;
};

export default function FreelancerProfile() {
  const { freelancerId } = useParams();
  const { freelancer } = useFreelancer();
  const [publicFreelancer, setPublicFreelancer] = useState(null);
  const [error, setError] = useState("");
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const badgeRef = useRef();
  const [noShowPolicy, setNoShowPolicy] = useState("");

  useEffect(() => {
    axios
      .get(`${API_BASE}/freelancer/public-info/${freelancerId}`)
      .then((res) => {
        const data = res.data;
        setPublicFreelancer(data);
        setNoShowPolicy(data.no_show_policy || "");
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
  if (!publicFreelancer)
    return <p className="text-center">Loading profile...</p>;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      {/* Logo + badge */}
      <div className="relative inline-block w-32 h-32">
        <img
          src={
            publicFreelancer.logo_url ||
            "https://placehold.co/128x128?text=Logo"
          }
          alt="Freelancer Logo"
          className="w-32 h-32 rounded-full object-cover border-2 border-white"
          style={{ boxShadow: "0 0 12px rgba(255,255,255,0.5)" }}
        />
        {publicFreelancer.is_verified && (
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
      {publicFreelancer.tagline && (
        <p className="text-sm italic text-gray-300 -mt-3">
          “{publicFreelancer.tagline}”
        </p>
      )}
      {/* Name and bullets */}
      <div>
        <h1 className="text-2xl font-bold">{publicFreelancer.business_name}</h1>
        <ul className="mt-4 text-left text-sm space-y-2">
          {publicFreelancer.bio && (
            <li className="italic text-gray-300">
              <strong className="not-italic text-white">Bio:</strong>{" "}
              {publicFreelancer.bio}
            </li>
          )}

          {publicFreelancer.timezone && (
            <p className="text-sm text-gray-400 text-center mb-2">
              <strong>Current Time Zone:</strong>{" "}
              {mapTimeZone(publicFreelancer.timezone)}
            </p>
          )}

          <div className="border border-white/20 bg-white/5 rounded-lg p-4 text-left mt-4">
            <h2 className="text-sm font-semibold text-white mb-2 uppercase tracking-wide text-center">
              Contact Info
            </h2>
            <ul className="space-y-1 text-sm text-gray-300">
              {publicFreelancer.email && (
                <li>
                  <strong className="text-white">Email:</strong>{" "}
                  <a
                    className="text-primary"
                    href={`mailto:${publicFreelancer.email}`}
                  >
                    {publicFreelancer.email}
                  </a>
                </li>
              )}
              {publicFreelancer.phone && (
                <li>
                  <strong className="text-white">Phone:</strong>{" "}
                  <a
                    className="text-primary"
                    href={`tel:${publicFreelancer.phone}`}
                  >
                    {publicFreelancer.phone}
                  </a>
                </li>
              )}
              {publicFreelancer.instagram_url && (
                <li>
                  <strong className="text-white">Instagram:</strong>{" "}
                  <a
                    className="text-primary"
                    href={publicFreelancer.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    DM here
                  </a>
                </li>
              )}
              {publicFreelancer.twitter_url && (
                <li>
                  <strong className="text-white">Twitter/X:</strong>{" "}
                  <a
                    className="text-primary"
                    href={publicFreelancer.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    DM here
                  </a>
                </li>
              )}
            </ul>
          </div>

          {publicFreelancer.services?.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-white text-center mb-2">
                Services
              </h2>
              <ul className="space-y-2 px-4">
                {publicFreelancer.services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    isPublicView={true}
                  />
                ))}
              </ul>
            </div>
          )}
          {publicFreelancer.services?.length === 0 && (
            <div className="mt-6 border border-white/20 bg-white/5 rounded-lg p-4 text-sm text-white text-center backdrop-blur-md shadow-md">
              <strong className="block mb-1 text-white/90 tracking-wide text-xs uppercase">
                No Services Listed
              </strong>
              <p className="text-white/80">
                This freelancer currently does not have any services listed.
                Please reach out to them directly for availability and options.
              </p>
            </div>
          )}
          <li>
            <NoShowPolicy policy={noShowPolicy} />
          </li>
          <li>
            <FAQCard text={publicFreelancer.faq_text} />
          </li>
        </ul>
      </div>
      {publicFreelancer.created_at && (
        <p className="text-xs text-gray-400">
          Joined{" "}
          {DateTime.fromISO(publicFreelancer.created_at).toFormat(
            "MMMM d, yyyy"
          )}
        </p>
      )}
      <Link
        to={`/book/${publicFreelancer.id}`}
        className="btn btn-primary mt-4"
      >
        Click Here to Book Me!
      </Link>
    </div>
  );
}
