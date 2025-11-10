// React Router Dom imports
import { Routes, Route } from "react-router-dom";

// Page Imports
import Home from "./pages/Home";
import BookingPage from "./pages/Booking";
import CRM from "./pages/CRM";
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
import BookingCancelled from "./pages/BookingCancelled";
import EmailConfirmed from "./pages/EmailConfirmed";
import DeleteConfirmation from "./pages/DeleteConfirmation";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import UpgradeSuccess from "./pages/UpgradeSuccess";
import UpgradeCancelled from "./pages/UpgradeCancelled";
import NavigatorInit from "./components/NavigatorInit";
import { PUBLIC_SAFE_PATHS } from "./utils/constants";
import AlreadyTaken from "./pages/AlreadyTaken";
import Settings from "./pages/Settings";

import PageTransition from "./components/Layout/PageTransition";

import WhySlotMe from "./pages/WhySlotMe";

import FooterNavbar from "./components/Layout/FooterNavbar";

import ConfirmEmailChange from "./pages/ConfirmEmailChange";

// Component Imports
import Navbar from "./components/Layout/Navbar";
import RequireDevAuth from "./components/Auth/RequireDevAuth";
import RequireFreelancerAuth from "./components/Auth/RequireFreelancerAuth";
import RequireTier from "./components/Auth/RequireTier";
import { Toaster } from "react-hot-toast"; // 🔼 Put this at the top

import { useEffect, useState } from "react";
import { useFreelancer } from "./context/FreelancerContext";

import { useLocation, useNavigate } from "react-router-dom";

import { showToast } from "./utils/toast";

import { tokenChannel, MESSAGE_TYPES } from "./utils/tokenChannel";

import { setNavigator } from "./utils/navigation";

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
      showToast("🔒 Session expired. You can keep browsing.", "info");
      return;
    }
    console.warn("🚪 Session expired — redirecting to login");
    showToast("🔒 Session expired. Logging out...", "warning");
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
    // 🔄 Cross-tab communication handler (for logout sync across tabs)
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
      tokenChannel.removeEventListener("message", handleMessage);
    };
  }, [navigate, setFreelancer, location.pathname]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavigatorInit />
      <Navbar />
      <FooterNavbar />

      <Toaster
        position="top-center"
        containerStyle={{
          top: "80px",
          left: 0,
          right: 0,
        }}
        toastOptions={{
          duration: 6000,
          style: {
            background: "#1F2937",
            color: "#fff",
            fontSize: "0.875rem",
            zIndex: 60,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          },
        }}
      />

      <div className="p-4 pb-20 lg:pb-4 w-full max-w-full overflow-x-hidden">
        <PageTransition>
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
                  <CRM />
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
                  <RequireTier
                    feature="analyticsFull"
                    backHref="/freelancer-admin"
                  >
                    <FreelancerAnalytics />
                  </RequireTier>
                </RequireFreelancerAuth>
              }
            />
            <Route
              path="/priority-support"
              element={
                <RequireFreelancerAuth>
                  <RequireTier
                    feature="prioritySupport"
                    backHref="/freelancer-admin"
                  >
                    <PrioritySupport />
                  </RequireTier>
                </RequireFreelancerAuth>
              }
            />
            <Route path="/404" element={<NotFound />} />
            <Route
              path="/:custom_url"
              element={<BookingPage useCustomUrl={true} />}
            />
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
            {/* New canonical route used in verification emails */}
            <Route path="/upgrade-success" element={<UpgradeSuccess />} />
            <Route path="/upgrade-cancelled" element={<UpgradeCancelled />} />
            <Route path="/already-taken" element={<AlreadyTaken />} />
            <Route path="/email-confirm" element={<EmailConfirmed />} />
            <Route path="/signup-confirmed" element={<EmailConfirmed />} />
            <Route
              path="/settings"
              element={
                <RequireFreelancerAuth>
                  <Settings />
                </RequireFreelancerAuth>
              }
            />
            <Route path="/cancel/:cancelToken" element={<BookingCancelled />} />
            <Route
              path="/delete-confirm/:token"
              element={<DeleteConfirmation />}
            />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/confirm-email-change"
              element={<ConfirmEmailChange />}
            />
            <Route path="/why-slotme" element={<WhySlotMe />} />
          </Routes>
        </PageTransition>
      </div>
    </div>
  );
}
