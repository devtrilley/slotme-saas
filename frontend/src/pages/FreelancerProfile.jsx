import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { FaCheck } from "react-icons/fa";
import ServiceCard from "../components/Cards/ServiceCard";
import NoShowPolicy from "../components/NoShowPolicy";
import FAQCard from "../components/Cards/FAQCard";
import { DateTime } from "luxon";
import { API_BASE } from "../utils/constants";
import ProfilePhoto from "../components/ProfilePhoto"; // adjust path as

import { useFreelancer } from "../context/FreelancerContext";
import BookingInstructionsCard from "../components/Cards/BookingInstructionsCard";
import SafeLoader from "../components/Layout/SafeLoader";

// Helper to decode HTML entities stored in the database
const decodeHTMLEntities = (text) => {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
};

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
  const [freelancerDetails, setFreelancerDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const badgeRef = useRef();
  const [noShowPolicy, setNoShowPolicy] = useState("");

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE}/freelancer/public-info/${freelancerId}`)
      .then((res) => {
        const data = res.data;
        setFreelancerDetails(data);
        setNoShowPolicy(data.no_show_policy || "");
        setError("");
      })
      .catch((err) => {
        console.error("❌ Failed to fetch profile:", err);
        setError("Unable to load this freelancer's profile. Please try again.");
      })
      .finally(() => setLoading(false));
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

  const handleRetry = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${API_BASE}/freelancer/public-info/${freelancerId}`)
      .then((res) => {
        const data = res.data;
        setFreelancerDetails(data);
        setNoShowPolicy(data.no_show_policy || "");
      })
      .catch((err) => {
        console.error("❌ Failed to fetch profile:", err);
        setError("Unable to load this freelancer's profile.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <SafeLoader loading={loading} error={error} onRetry={handleRetry}>
      {!freelancerDetails ? null : (
        <main className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
          {/* Logo + badge */}
          <div className="relative inline-block w-32 h-32">
            <ProfilePhoto
              src={freelancerDetails.logo_url}
              tier={freelancerDetails.tier}
              size="w-32 h-32"
            />
            {freelancerDetails.is_verified && (
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
                  <div
                    role="tooltip"
                    aria-hidden={!tooltipVisible}
                    className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                  >
                    Verified Freelancer
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Tagline */}
          {freelancerDetails.tagline && (
            <p className="text-sm italic text-gray-300 -mt-3">
              "{decodeHTMLEntities(freelancerDetails.tagline)}"
            </p>
          )}
          {/* Name and bullets */}
          <div>
            <Link
              to={
                freelancerDetails.custom_url
                  ? `/${freelancerDetails.custom_url}`
                  : freelancerDetails.public_slug
                  ? `/${freelancerDetails.public_slug}`
                  : `/book/${freelancerDetails.id}`
              }
              className="btn btn-primary mb-4"
            >
              Click Here to Book Me!
            </Link>
            <h1 className="text-2xl font-bold">
              {freelancerDetails.business_name}
            </h1>
            <ul className="mt-4 text-left text-sm space-y-2">
              {freelancerDetails.bio && (
                <li className="italic text-gray-300">
                  <strong className="not-italic text-white">Bio:</strong>{" "}
                  {decodeHTMLEntities(freelancerDetails.bio)}
                </li>
              )}

              <div
                className="mt-10 mb-10 p-5 rounded-2xl
  bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950
  border border-slate-700
  shadow-md text-left"
              >
                <h2 className="text-sm font-semibold text-white mb-2 uppercase tracking-wide text-center">
                  Contact Info
                </h2>
                <ul className="space-y-1 text-sm text-gray-300">
                  {freelancerDetails.email && (
                    <li>
                      <strong className="text-white">Email:</strong>{" "}
                      <a
                        className="text-primary"
                        href={`mailto:${freelancerDetails.email}`}
                      >
                        {freelancerDetails.email}
                      </a>
                    </li>
                  )}
                  {freelancerDetails.phone && (
                    <li>
                      <strong className="text-white">Phone:</strong>{" "}
                      <a
                        className="text-primary"
                        href={`tel:${freelancerDetails.phone}`}
                      >
                        {freelancerDetails.phone}
                      </a>
                    </li>
                  )}
                  {freelancerDetails.location && (
                    <li>
                      <strong className="text-white">Location:</strong>{" "}
                      {freelancerDetails.location}
                    </li>
                  )}
                  {freelancerDetails.preferred_payment_methods && (
                    <li>
                      <strong className="text-white">Payment Methods:</strong>{" "}
                      {freelancerDetails.preferred_payment_methods}
                    </li>
                  )}
                  {freelancerDetails.instagram_url && (
                    <li>
                      <strong className="text-white">Instagram:</strong>{" "}
                      <a
                        className="text-primary"
                        href={freelancerDetails.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        DM here
                      </a>
                    </li>
                  )}
                  {freelancerDetails.twitter_url && (
                    <li>
                      <strong className="text-white">Twitter/X:</strong>{" "}
                      <a
                        className="text-primary"
                        href={freelancerDetails.twitter_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        DM here
                      </a>
                    </li>
                  )}
                </ul>
              </div>

              {freelancerDetails.services?.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold text-white text-center mb-2">
                    Services
                  </h2>
                  {freelancerDetails.timezone && (
                    <p className="text-sm text-gray-400 text-center mb-2">
                      <strong>Current Time Zone:</strong>{" "}
                      {mapTimeZone(freelancerDetails.timezone)}
                    </p>
                  )}
                  <ul className="space-y-2 px-4">
                    {freelancerDetails.services.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        isPublicView={true}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {freelancerDetails.services?.length === 0 && (
                <div className="mt-6 border border-white/20 bg-white/5 rounded-lg p-4 text-sm text-white text-center backdrop-blur-md shadow-md">
                  <strong className="block mb-1 text-white/90 tracking-wide text-xs uppercase">
                    No Services Listed
                  </strong>
                  <p className="text-white/80">
                    This freelancer currently does not have any services listed.
                    Please reach out to them directly for availability and
                    options.
                  </p>
                </div>
              )}
              <li className="mt-10 mb-10">
                <NoShowPolicy policy={noShowPolicy} />
              </li>
              <li>
                <FAQCard faq_items={freelancerDetails.faq_items} />{" "}
              </li>
            </ul>
          </div>
          <div className="text-left">
            <BookingInstructionsCard
              instructions={freelancerDetails.booking_instructions}
            />
          </div>
          {freelancerDetails.created_at &&
            DateTime.fromISO(freelancerDetails.created_at).isValid && (
              <p className="text-xs text-gray-400">
                Joined{" "}
                {DateTime.fromISO(freelancerDetails.created_at).toFormat(
                  "MMMM d, yyyy"
                )}
              </p>
            )}
          <Link
            to={
              freelancerDetails.custom_url
                ? `/${freelancerDetails.custom_url}`
                : freelancerDetails.public_slug
                ? `/${freelancerDetails.public_slug}`
                : `/book/${freelancerDetails.id}`
            }
            className="btn btn-primary mb-4"
          >
            Click Here to Book Me!
          </Link>
        </main>
      )}
    </SafeLoader>
  );
}
