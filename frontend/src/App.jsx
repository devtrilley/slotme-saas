import { Routes, Route } from "react-router-dom";
import BookingPage from "./pages/BookingPage";
import BookingList from "./pages/BookingList";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BookingPage />} />
      <Route path="/bookings" element={<BookingList />} />
    </Routes>
  );
}
