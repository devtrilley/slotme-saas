// src/components/Modals/FreelancerModal.jsx
import { Link } from "react-router-dom";
import BaseModal from "./BaseModal";
import ProfilePhoto from "../ProfilePhoto";

export default function FreelancerModal({
  freelancer,
  open = true,
  onClose,
  showEmail = false,
}) {
  if (!freelancer) return null;

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      dismissible // clicking backdrop closes
      showCloseX // render the X button
      title={null} // we render the heading inside, not in the modal header
    >
      {/* Logo + Badge */}
      <div className="flex justify-center mb-4 mt-3">
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
          `${freelancer.first_name ?? ""} ${freelancer.last_name ?? ""}`.trim()}
      </h2>

      {showEmail && freelancer.email && (
        <p className="text-xs text-gray-400 text-center mt-1">
          📧 {freelancer.email}
        </p>
      )}

      {freelancer.tagline && (
        <p className="italic text-sm text-gray-400 text-center mt-1">
          "{freelancer.tagline}"
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
        to={
          freelancer.custom_url
            ? `/freelancers/${freelancer.custom_url}`
            : freelancer.public_slug
            ? `/freelancers/${freelancer.public_slug}`
            : `/freelancers/${freelancer.id}`
        }
        className="btn btn-primary mt-6 w-full"
        onClick={onClose}
      >
        Visit Profile
      </Link>
    </BaseModal>
  );
}
