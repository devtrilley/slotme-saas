// React Router Dom imports
import { Routes, Route } from "react-router-dom";

// Page Imports
import BookingPage from "./pages/BookingPage";
import BookingList from "./pages/BookingList";
import AdminPage from "./pages/AdminPage";
import DevLogin from "./pages/DevLogin";
import DevAdmin from "./pages/DevAdmin";

// Component Imports
import Navbar from "./components/Navbar";
import DevProtectedRoute from "./components/DevProtectedRoute";
import RequireDevAuth from "./components/RequireDevAuth";


export default function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />
      <div className="p-4">
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/dev-login" element={<DevLogin />} />
          {/* Protected Routes */}
          <Route
            path="/admin"
            element={
              <DevProtectedRoute>
                <AdminPage />
              </DevProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <DevProtectedRoute>
                <BookingList />
              </DevProtectedRoute>
            }
          />

          {/*  Inside Routes */}
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
