// React Router Dom imports
import { Routes, Route, useParams } from "react-router-dom";

// Page Imports
import BookingPage from "./pages/BookingPage";
import ClientBookingList from "./pages/ClientBookingList";
import ClientAdmin from "./pages/ClientAdmin";
import ClientLogin from "./pages/ClientLogin";
import DevLogin from "./pages/DevLogin";
import DevAdmin from "./pages/DevAdmin";
import DevClientSlots from "./pages/DevClientSlots";
import DevClientBookings from "./pages/DevClientBookings"; // at the top
import NewClient from "./pages/NewClient";

// Component Imports
import Navbar from "./components/Navbar";
import RequireDevAuth from "./components/RequireDevAuth";
import RequireClientAuth from "./components/RequireClientAuth";

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

          {/* DevClientSlots */}
          <Route path="/dev/slots/:clientId" element={<DevClientSlots />} />

          <Route
            path="/dev/appointments/:clientId"
            element={<DevClientBookings />}
          />

          <Route
            path="/dev/new-client"
            element={
              <RequireDevAuth>
                <NewClient />
              </RequireDevAuth>
            }
          />

          <Route path="/book/:clientId" element={<BookingPage />} />
        </Routes>
      </div>
    </div>
  );
}
