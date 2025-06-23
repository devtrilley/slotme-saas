// React Router Dom imports
import { Routes, Route } from "react-router-dom";

// Page Imports
import Home from "./pages/Home";
import BookingPage from "./pages/Booking";
import FreelancerBookingList from "./pages/FreelancerBookingList";
import FreelancerAdmin from "./pages/FreelancerAdmin";
import DevLogin from "./pages/DevLogin";
import DevAdmin from "./pages/DevAdmin";
import DevFreelancerSlots from "./pages/DevFreelancerSlots";
import DevFreelancerBookings from "./pages/DevFreelancerBookings";
import NewFreelancer from "./pages/NewFreelancer";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Upgrade from "./pages/Upgrade";
import FreelancerProfile from "./pages/FreelancerProfile";
import FreelancerAnalytics from "./pages/FreelancerAnalytics";
import PrioritySupport from "./pages/PrioritySupport";
import QRCodePage from "./pages/QRCodePage";
import Feedback from "./pages/Feedback";
import SignupSuccess from "./pages/SignupSuccess";
import BookingSuccess from "./pages/BookingSuccess";
import BookingConfirmed from "./pages/BookingConfirmed";
import SignupConfirmed from "./pages/SignupConfirmed";
import UpgradeSuccess from "./pages/UpgradeSuccess"; // or wherever the file lives
import UpgradeCancelled from "./pages/UpgradeCancelled";
import NavigatorInit from "./components/NavigatorInit";

// Component Imports
import Navbar from "./components/Navbar";
import RequireDevAuth from "./components/RequireDevAuth";
import RequireFreelancerAuth from "./components/RequireFreelancerAuth";
import CustomUrlRouter from "./components/CustomUrlRouter";

// Context Import
import { FreelancerProvider } from "./context/FreelancerContext";

import { useEffect, useState } from "react";
import { useFreelancer } from "./context/FreelancerContext";
import { API_BASE } from "./utils/constants";

import { isTokenExpired } from "./utils/jwt";

import { useLocation, useNavigate } from "react-router-dom";

import { showToast } from "./utils/toast";

import { tokenChannel, MESSAGE_TYPES } from "./utils/tokenChannel";

import { setNavigator } from "./utils/navigation";

import axios from "./utils/axiosInstance"; // If not already at top

export default function App() {
  const { setFreelancer } = useFreelancer();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);

  useEffect(() => {
    const storageHandler = (e) => {
      if (e.key === "access_token" && !e.newValue) {
        console.warn("🚨 Token deleted manually or expired");
        showToast("🔒 Session expired. Redirecting to login...", "error");
        navigate("/auth", { state: { sessionExpired: true } });
      }
    };
    window.addEventListener("storage", storageHandler);
    return () => window.removeEventListener("storage", storageHandler);
  }, [navigate]);

  useEffect(() => {
    const checkTokenAndRefresh = async () => {
      const token = localStorage.getItem("access_token");

      // 🛑 Skip if no token OR already on auth page
      if (!token || location.pathname === "/auth") return;

      if (isTokenExpired(token)) {
        console.warn("⏳ Token is expired — refreshing...");
      }

      try {
        const res = await axios.post("/refresh");
        const data = res.data;

        if (
          data.access_token &&
          typeof data.access_token === "string" &&
          data.access_token.length > 50
        ) {
          localStorage.setItem("access_token", data.access_token);
          console.log("🔁 Token refreshed and saved to localStorage");

          // 📢 Notify other tabs
          tokenChannel.postMessage({
            type: MESSAGE_TYPES.TOKEN_REFRESH,
            payload: data.access_token,
          });
        } else {
          console.warn("⚠️ Invalid or missing access token in response:", data);
          showToast("❌ No valid token returned from refresh", "error");
          handleSessionExpired();
        }
      } catch (err) {
        console.error("❌ Token refresh failed", err);
        handleSessionExpired();
      }
    };

    const handleSessionExpired = () => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("freelancer_id");
      localStorage.removeItem("freelancer_logged_in");

      tokenChannel.postMessage({ type: MESSAGE_TYPES.SESSION_EXPIRED });

      navigate("/auth", { state: { sessionExpired: true } });
    };

    checkTokenAndRefresh();
    const interval = setInterval(checkTokenAndRefresh, 14 * 60 * 1000); // 14 min

    const handleMessage = (e) => {
      const { type, payload } = e.data;

      if (type === MESSAGE_TYPES.TOKEN_REFRESH && payload) {
        console.log("📡 Token updated from another tab");
        localStorage.setItem("access_token", payload);
      }

      if (type === MESSAGE_TYPES.SESSION_EXPIRED) {
        console.log("📡 Session expired in another tab");
        handleSessionExpired();
      }
    };

    tokenChannel.addEventListener("message", handleMessage);

    return () => {
      clearInterval(interval);
      tokenChannel.removeEventListener("message", handleMessage);
    };
  }, [navigate, setFreelancer, location.pathname]);

  return (
    <div className="h-full bg-base-200">
      <NavigatorInit />
      <Navbar />

      <div
        id="toast-container"
        className="toast toast-top toast-center fixed z-50"
      ></div>

      <div className="p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dev-login" element={<DevLogin />} />
          <Route
            path="/freelancer-admin"
            element={
              <RequireFreelancerAuth>
                <FreelancerAdmin />
              </RequireFreelancerAuth>
            }
          />
          <Route
            path="/freelancer-bookings"
            element={
              <RequireFreelancerAuth>
                <FreelancerBookingList />
              </RequireFreelancerAuth>
            }
          />
          <Route
            path="/dev-admin"
            element={
              <RequireDevAuth>
                <DevAdmin />
              </RequireDevAuth>
            }
          />
          <Route
            path="/dev/slots/:freelancerId"
            element={<DevFreelancerSlots />}
          />
          <Route
            path="/dev/appointments/:freelancerId"
            element={<DevFreelancerBookings />}
          />
          <Route
            path="/dev/new-freelancer"
            element={
              <RequireDevAuth>
                <NewFreelancer />
              </RequireDevAuth>
            }
          />
          <Route path="/book/:freelancerId" element={<BookingPage />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route
            path="/freelancers/:freelancerId"
            element={<FreelancerProfile />}
          />
          <Route
            path="/freelancer-analytics"
            element={
              <RequireFreelancerAuth>
                <FreelancerAnalytics />
              </RequireFreelancerAuth>
            }
          />
          <Route path="/priority-support" element={<PrioritySupport />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="/:custom_url" element={<CustomUrlRouter />} />
          <Route path="*" element={<NotFound />} />
          <Route path="/qr-code" element={<QRCodePage />} />

          <Route path="/feedback" element={<Feedback />} />

          <Route path="/signup-success" element={<SignupSuccess />} />
          <Route path="/booking-success" element={<BookingSuccess />} />

          <Route path="/booking-confirmed" element={<BookingConfirmed />} />
          <Route path="/signup-confirmed" element={<SignupConfirmed />} />

          <Route path="/upgrade-success" element={<UpgradeSuccess />} />
          <Route path="/upgrade-cancelled" element={<UpgradeCancelled />} />
        </Routes>
      </div>
    </div>
  );
}
