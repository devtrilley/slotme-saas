// React Router Dom imports
import { Routes, Route, useParams } from "react-router-dom";

// Page Imports
import Home from "./pages/Home";
import BookingPage from "./pages/Booking";
import FreelancerBookingList from "./pages/FreelancerBookingList";
import FreelancerAdmin from "./pages/FreelancerAdmin";
import DevLogin from "./pages/DevLogin";
import DevAdmin from "./pages/DevAdmin";
import DevFreelancerSlots from "./pages/DevFreelancerSlots";
import DevFreelancerBookings from "./pages/DevFreelancerBookings"; // at the top
import NewFreelancer from "./pages/NewFreelancer";
import Auth from "./pages/Auth";
import ThankYou from "./pages/ThankYou";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Upgrade from "./pages/Upgrade";

// Component Imports
import Navbar from "./components/Navbar";
import RequireDevAuth from "./components/RequireDevAuth";
import RequireFreelancerAuth from "./components/RequireFreelancerAuth";

export default function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />

      <div
        id="toast-container"
        className="toast toast-top toast-center fixed z-50"
      ></div>

      <div className="p-4">
        <Routes>
          {/* Public booking page */}
          <Route path="/" element={<Home />} />

          {/* Login routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/dev-login" element={<DevLogin />} />

          {/* Freelancer Admin protected routes */}
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

          {/* Dev Admin protected route */}
          <Route
            path="/dev-admin"
            element={
              <RequireDevAuth>
                <DevAdmin />
              </RequireDevAuth>
            }
          />

          {/* DevFreelancerSlots */}
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

          <Route path="/Auth" element={<Auth />} />

          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/upgrade" element={<Upgrade />} />

          {/* 404 fallback route — keep this last */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}
