// React Router Dom imports
import { Routes, Route } from "react-router-dom";

// Page Imports
import BookingPage from "./pages/Booking";
import ClientBookingList from "./pages/ClientBookingList";
import ClientAdmin from "./pages/ClientAdmin";
import ClientLogin from "./pages/ClientLogin";
import DevLogin from "./pages/DevLogin";
import DevAdmin from "./pages/DevAdmin";

// Component Imports
import Navbar from "./components/Navbar";
import DevProtectedRoute from "./components/DevProtectedRoute";
import RequireDevAuth from "./components/RequireDevAuth";
import RequireClientAuth from "./components/RequireClientAuth";

export default function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />
      <div className="p-4">
        <Routes>
          {/* Public booking page */}
          <Route path="/" element={<BookingPage />} />

          {/* Login routes */}
          <Route path="/client-login" element={<ClientLogin />} />
          <Route path="/dev-login" element={<DevLogin />} />

          {/* Client Admin protected routes */}
          <Route
            path="/client-admin"
            element={
              <RequireClientAuth>
                <ClientAdmin />
              </RequireClientAuth>
            }
          />
          <Route
            path="/client-bookings"
            element={
              <RequireClientAuth>
                <ClientBookingList />
              </RequireClientAuth>
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
        </Routes>
      </div>
    </div>
  );
}