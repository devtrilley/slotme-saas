// Later, if you move to production, you just change it in one place.
export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:5000";

export const PUBLIC_SAFE_PATHS = [
  "/book",
  "/booking-success",
  "/booking-confirmed",
  "/signup-confirmed",
  "/signup-success",
  "/freelancers",
  "/upgrade-success",
  "/upgrade-cancelled",
  "/terms",
  "/privacy",
  "/feedback",
];
