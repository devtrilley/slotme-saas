// src/utils/tiers.js
export const TIERS = ["free", "pro", "elite"];

// Map every feature key to the MINIMUM tier that unlocks it.
// (Keep names stable so UI + guards share the same keys.)
export const FEATURES_BY_TIER = {
  // Always-on across all tiers
  unlimitedBookings: "free",
  branding: "free", // logo, bio, tagline
  services: "free", // add services to booking page
  qrCodes: "free", // QR code for public profile
  noShowPolicy: "free",
  analyticsBasic: "free",

  // Pro and up
  analyticsFull: "pro",
  customURL: "pro",
  verifiedBadge: "pro",
  exportCSV: "pro",
  emailReminders: "pro",
  smsReminders: "pro",

  // Elite only
  prioritySupport: "elite",
  earlyAccess: "elite",
  calendarSync: "elite",
};

export function hasTierAccess(userTier = "free", minTier = "free") {
  return TIERS.indexOf(userTier) >= TIERS.indexOf(minTier);
}

export function requiredTierFor(featureKey) {
  return FEATURES_BY_TIER[featureKey] || "free";
}
