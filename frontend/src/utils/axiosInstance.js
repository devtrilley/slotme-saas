import axios from "axios";
import { API_BASE } from "./constants";
import { showToast } from "./toast";
import { tokenChannel, MESSAGE_TYPES } from "./tokenChannel";
import { redirectToAuth } from "./navigation";

// 🔓 Routes that are public—booking side, matching open_paths & open_prefixes
const publicEndpoints = [
  // booking / public
  "/book",
  "/freelancer/public-info",
  "/freelancer/slots",
  "/check-booking-status",
  "/resend-confirmation",
  "/confirm-booking",
  "/appointment/", // specific appointment routes
  "/download-ics",
  "/feedback",

  // auth (login + signup + email verification are public)
  "/auth",
  "/auth/signup",
  "/auth/verify-email",

  // upgrade result pages
  "/upgrade-success",
  "/upgrade-cancelled",

  // misc dev/test
  "/test-email",

  // stripe (frontend reads status; webhook is backend-used but harmless here)
  "/stripe/check-session-status",
  "/stripe/webhook",
];

let hasShownSessionExpired = false;

export function resetSessionFlag() {
  hasShownSessionExpired = false;
}

const axiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // ⏱️ 10 second timeout for all requests
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  //OG const urlPath = config.url.replace(API_BASE, "");
  const urlPath = new URL(config.url, API_BASE).pathname;

  // Improved public detection:
  const isPublic =
    publicEndpoints.some((endpoint) => urlPath.startsWith(endpoint)) ||
    urlPath === "/appointment"; // Exact match for bare /appointment

  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`;
    // console.log("📤 Attaching token to request:", token);
  } else if (!isPublic) {
    console.log("⚠️ No token found — unauthenticated protected request");
  } else {
    console.log("🌐 Public request — no auth header attached");
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const message = (
      err.response?.data?.error ||
      err.response?.data?.msg ||
      ""
    ).toLowerCase();

    const isTokenError =
      status === 401 ||
      (status === 422 &&
        (message.includes("token") ||
          message.includes("unauthorized") ||
          message.includes("signature") ||
          message.includes("jwt") ||
          message.includes("missing") ||
          message.includes("expired") ||
          message.includes("not enough segments")));

    const attemptedUrl = err.config?.url?.replace(API_BASE, "") || "";
    const isPublic = publicEndpoints.some((p) => attemptedUrl.startsWith(p));
    const isAuthPage = window.location.pathname.startsWith("/auth");

    if (isTokenError && !hasShownSessionExpired && !isPublic && !isAuthPage) {
      console.warn("❌ Token invalid or expired — broadcasting logout");
      hasShownSessionExpired = true;
      showToast("🔒 Session expired — redirecting you to log in.", "error");

      localStorage.removeItem("access_token");
      localStorage.removeItem("freelancer_id");
      localStorage.removeItem("freelancer_logged_in");

      tokenChannel.postMessage({ type: MESSAGE_TYPES.SESSION_EXPIRED });

      redirectToAuth();
    }

    return Promise.reject(err);
  }
);

export default axiosInstance;
