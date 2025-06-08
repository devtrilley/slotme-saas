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

// Component Imports
import Navbar from "./components/Navbar";
import RequireDevAuth from "./components/RequireDevAuth";
import RequireFreelancerAuth from "./components/RequireFreelancerAuth";
import CustomUrlRouter from "./components/CustomUrlRouter";

export default function App() {
  return (
    <div className="h-full bg-base-200">
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
        </Routes>
      </div>
    </div>
  );
}
