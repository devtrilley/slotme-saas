import axios from "axios";
import { API_BASE } from "./constants";
import { showToast } from "./toast";
import { tokenChannel, MESSAGE_TYPES } from "./tokenChannel";
import { redirectToAuth } from "./navigation";

let hasShownSessionExpired = false;

export function resetSessionFlag() {
  hasShownSessionExpired = false;
}

const axiosInstance = axios.create({
  baseURL: API_BASE,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log("📤 Attaching token to request:", token);
  } else {
    console.log("⚠️ No token found — unauthenticated request");
  }
  return config;
});

// ✅ Unified response interceptor
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

    if (isTokenError && !hasShownSessionExpired) {
      console.warn("❌ Token invalid or expired — broadcasting logout");
      hasShownSessionExpired = true;
      showToast("🔒 Session expired — redirecting you to log in.", "error");

      localStorage.removeItem("access_token");
      localStorage.removeItem("freelancer_id");
      localStorage.removeItem("freelancer_logged_in");

      tokenChannel.postMessage({ type: MESSAGE_TYPES.SESSION_EXPIRED });

      redirectToAuth(); // Clean redirect
    }

    return Promise.reject(err);
  }
);

export default axiosInstance;
