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
import { PUBLIC_SAFE_PATHS } from "./utils/constants";
import AlreadyTaken from "./pages/AlreadyTaken";

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
  const { setFreelancer = () => {} } = useFreelancer() || {};
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);

  const isPublicSafePage = (pathname) =>
    PUBLIC_SAFE_PATHS.some((p) => pathname.startsWith(p));

  const handleSessionExpired = () => {
    if (isPublicSafePage(location.pathname)) {
      console.warn(
        "✅ Session expired but staying on public page:",
        location.pathname
      );
      showToast("🔒 Session expired. You can continue browsing.", "info");
      return;
    }
    console.warn("🚪 Session expired — redirecting to login");
    showToast("🔒 Session expired. Redirecting to login...", "error");
    localStorage.removeItem("access_token");
    localStorage.removeItem("freelancer_id");
    localStorage.removeItem("freelancer_logged_in");
    navigate("/auth", { state: { sessionExpired: true } });
  };

  useEffect(() => {
    const storageHandler = (e) => {
      if (e.key === "access_token" && !e.newValue) {
        console.warn("🚨 Token deleted manually or expired");
        handleSessionExpired();
      }
    };
    window.addEventListener("storage", storageHandler);
    return () => window.removeEventListener("storage", storageHandler);
  }, [navigate, location.pathname]);

  useEffect(() => {
    const checkTokenAndRefresh = () => {
      const token = localStorage.getItem("access_token");

      if (!token || location.pathname === "/auth") return;

      const protectedRoutes = [
        "/freelancer-admin",
        "/freelancer-bookings",
        "/freelancer-analytics",
        "/priority-support",
        "/qr-code",
        "/upgrade",
      ];

      const isProtected = protectedRoutes.some((path) =>
        location.pathname.startsWith(path)
      );

      if (!isProtected) return;

      if (isTokenExpired(token)) {
        console.warn("⏳ Token expired — redirecting to login");
        handleSessionExpired();
      }
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
            element={
              <RequireDevAuth>
                <DevFreelancerSlots />
              </RequireDevAuth>
            }
          />
          <Route
            path="/dev/appointments/:freelancerId"
            element={
              <RequireDevAuth>
                <DevFreelancerBookings />
              </RequireDevAuth>
            }
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

          <Route
            path="/priority-support"
            element={
              <RequireFreelancerAuth>
                <PrioritySupport />
              </RequireFreelancerAuth>
            }
          />
          <Route path="/404" element={<NotFound />} />
          <Route path="/:custom_url" element={<CustomUrlRouter />} />
          <Route path="*" element={<NotFound />} />
          <Route
            path="/qr-code"
            element={
              <RequireFreelancerAuth>
                <QRCodePage />
              </RequireFreelancerAuth>
            }
          />

          <Route path="/feedback" element={<Feedback />} />

          <Route path="/signup-success" element={<SignupSuccess />} />
          <Route path="/booking-success" element={<BookingSuccess />} />

          <Route path="/booking-confirmed" element={<BookingConfirmed />} />
          <Route path="/signup-confirmed" element={<SignupConfirmed />} />

          <Route path="/upgrade-success" element={<UpgradeSuccess />} />
          <Route path="/upgrade-cancelled" element={<UpgradeCancelled />} />

          <Route path="/already-taken" element={<AlreadyTaken />} />
        </Routes>
      </div>
    </div>
  );
}
