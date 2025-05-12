// src/App.jsx
import { Routes, Route } from "react-router-dom";
import BookingPage from "./pages/BookingPage";
import BookingList from "./pages/BookingList";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />
      <div className="p-4">
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/bookings" element={<BookingList />} />
        </Routes>
      </div>
    </div>
  );
}