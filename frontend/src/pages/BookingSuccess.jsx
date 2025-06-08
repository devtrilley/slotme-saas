// src/pages/BookingSuccess.jsx
import { MailCheck, Smile } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BookingSuccess() {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      <div className="flex flex-col items-center space-y-2">
        <Smile className="text-green-400 w-12 h-12" />
        <h1 className="text-2xl font-bold">Booking Received!</h1>
        <p className="text-purple-300">
          You're almost done. We sent you an email — click the confirmation link to finalize your appointment.
        </p>
      </div>

      <div className="flex items-center justify-center space-x-2 text-sm text-white/60">
        <MailCheck className="w-4 h-4 text-white/60" />
        <span>Haven’t received it? Check your spam folder.</span>
      </div>

      <button
        onClick={() => navigate("/")}
        className="mt-4 text-sm text-blue-400 hover:underline"
      >
        ← Back to Homepage
      </button>
    </div>
  );
}