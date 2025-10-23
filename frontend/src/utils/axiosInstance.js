import axios from "axios";
import { API_BASE } from "./constants";
import { showToast } from "./toast";
import { tokenChannel, MESSAGE_TYPES } from "./tokenChannel";
import { redirectToAuth } from "./navigation";

// 🌐 Routes that are public—booking side, matching open_paths & open_prefixes
const publicEndpoints = [
  "/book",
  "/freelancer/public-info",
  "/freelancer/slots",
  "/check-booking-status",
  "/resend-confirmation",
  "/confirm-booking",
  "/appointment/",
  "/download-ics",
  "/feedback",
  "/auth/signup",  // ✅ Keep only specific public auth routes
  "/auth/verify-email",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/resend-verification",
  "/upgrade-success",
  "/upgrade-cancelled",
  "/test-email",
  "/stripe/check-session-status",
  "/stripe/webhook",
];

let hasShownSessionExpired = false;
let isRefreshing = false; // ✅ Prevent multiple simultaneous refresh attempts
let refreshSubscribers = []; // ✅ Queue requests waiting for token refresh

export function resetSessionFlag() {
  hasShownSessionExpired = false;
}

// ✅ Helper: Add failed request to queue
function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

// ✅ Helper: Retry all queued requests with new token
function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

const axiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// 📤 REQUEST INTERCEPTOR: Attach access token
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  const devToken = localStorage.getItem("dev_access_token");
  const urlPath = new URL(config.url, API_BASE).pathname;

  const isPublic = publicEndpoints.some((endpoint) =>
    urlPath.startsWith(endpoint)
  );

  // If dev route, use dev token
  if (urlPath.startsWith("/dev")) {
    if (devToken) {
      config.headers.Authorization = `Bearer ${devToken}`;
    }
    return config; // Early return for dev routes
  }

  // Attach freelancer token to protected routes
  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// 🔥 RESPONSE INTERCEPTOR: Handle 401s with auto-refresh
axiosInstance.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
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

    const attemptedUrl = originalRequest?.url?.replace(API_BASE, "") || "";
    const isPublic = publicEndpoints.some((p) => attemptedUrl.startsWith(p));
    const isAuthPage = window.location.pathname.startsWith("/auth");
    const isDevRoute = attemptedUrl.startsWith("/dev");
    const isDevPage = window.location.pathname.startsWith("/dev");

    // 🔴 DEV TOKEN EXPIRED: Redirect to dev login, no refresh attempt
    if (isTokenError && (isDevRoute || isDevPage) && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!hasShownSessionExpired) {
        hasShownSessionExpired = true;
        showToast("Dev session expired. Logging out...", "warning");

        localStorage.removeItem("dev_access_token");
        localStorage.removeItem("dev_logged_in");

        // Redirect to dev login
        window.location.href = "/dev-login";
      }

      return Promise.reject(err);
    }

    // 🔄 AUTO-REFRESH LOGIC: Try to refresh access token if 401 on protected route
    if (isTokenError && !isPublic && !isAuthPage && !originalRequest._retry) {
      originalRequest._retry = true; // ✅ Prevent infinite retry loop

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axiosInstance(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");

        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        console.log("🔄 Access token expired, attempting refresh...");

        // Call refresh endpoint with refresh token
        const refreshResponse = await axios.post(
          `${API_BASE}/auth/refresh`,
          {},
          {
            headers: { Authorization: `Bearer ${refreshToken}` },
          }
        );

        const newAccessToken = refreshResponse.data.access_token;

        // ✅ Store new access token
        localStorage.setItem("access_token", newAccessToken);
        console.log("✅ Token refreshed successfully");

        // Update original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Retry all queued requests
        onRefreshed(newAccessToken);
        isRefreshing = false;

        // Retry the original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error("❌ Token refresh failed:", refreshError);
        isRefreshing = false;
        refreshSubscribers = [];

        // Refresh token expired or invalid - log user out
        if (!hasShownSessionExpired) {
          hasShownSessionExpired = true;
          showToast(
            "Session expired. Logging out...",
            "warning"
          );

          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("freelancer_id");
          localStorage.removeItem("freelancer_logged_in");

          tokenChannel.postMessage({ type: MESSAGE_TYPES.SESSION_EXPIRED });
          redirectToAuth();
        }

        return Promise.reject(refreshError);
      }
    }

    // If not a token error or already on auth page, just reject
    return Promise.reject(err);
  }
);

export default axiosInstance;
