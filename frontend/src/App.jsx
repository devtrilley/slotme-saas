// React Router Dom imports
import { Routes, Route } from "react-router-dom";

// Page Imports
import BookingPage from "./pages/BookingPage";
import BookingList from "./pages/BookingList";
import AdminPage from "./pages/AdminPage";

// Component Imports
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />
      <div className="p-4">
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/bookings" element={<BookingList />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </div>
  );
}
