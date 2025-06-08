// src/pages/BookingConfirmed.jsx
import { CalendarCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BookingConfirmed() {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      <CalendarCheck className="text-green-400 w-12 h-12 mx-auto" />
      <h1 className="text-2xl font-bold">Booking Confirmed!</h1>
      <p className="text-purple-300">
        Your appointment is officially confirmed. We’ll see you there!
      </p>
      <button
        onClick={() => navigate("/")}
        className="mt-4 text-sm text-blue-400 hover:underline"
      >
        ← Return to Homepage
      </button>
    </div>
  );
}