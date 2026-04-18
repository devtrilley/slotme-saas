// src/utils/tiers.js
export const TIERS = ["free", "pro"];

export const FEATURES_BY_TIER = {
  // Always-on across all tiers
  unlimitedBookings: "free",
  branding: "free",
  services: "free",
  qrCodes: "free",
  noShowPolicy: "free",
  analyticsBasic: "free",
  emailReminders: "free",
  // Pro only
  analyticsFull: "pro",
  customURL: "pro",
  verifiedBadge: "pro",
  exportCSV: "pro",
  smsReminders: "pro",
  addons: "pro",
  prioritySupport: "pro",
};

export function hasTierAccess(userTier = "free", minTier = "free") {
  return TIERS.indexOf(userTier) >= TIERS.indexOf(minTier);
}

export function requiredTierFor(featureKey) {
  return FEATURES_BY_TIER[featureKey] || "free";
}
