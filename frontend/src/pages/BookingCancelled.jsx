// src/pages/BookingCancelled.jsx

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { CalendarX, Loader2, CheckCircle } from "lucide-react";
import { API_BASE } from "../utils/constants";

export default function BookingCancelled() {
  const { cancelToken } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | failed | kept

  useEffect(() => {
    if (!cancelToken) return;
    axios
      .get(`${API_BASE}/preview-cancel/${cancelToken}`)
      .then((res) => setAppointment(res.data))
      .catch(() => setStatus("failed"));
  }, [cancelToken]);

  const handleCancel = async () => {
    setStatus("loading");
    try {
      await axios.get(`${API_BASE}/cancel-booking/${cancelToken}`);
      setStatus("success");
      setTimeout(() => navigate("/"), 3500);
    } catch (err) {
      console.error("Cancellation failed:", err);
      setStatus("failed");
    }
  };

  const handleKeep = () => {
    setStatus("kept");
    setTimeout(() => navigate("/"), 3500);
  };

  if (status === "failed") {
    return (
      <div className="max-w-md mx-auto p-6 text-center text-white">
        <CalendarX className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-red-400">
          Invalid or expired link
        </h2>
        <p className="text-sm text-gray-400 mt-2">
          This cancellation link is no longer valid.
        </p>
        <button
          className="mt-4 text-sm text-blue-400 hover:underline"
          onClick={() => navigate("/")}
        >
          ← Return to Homepage
        </button>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-center text-white mt-10">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading booking details...
      </div>
    );
  }

  const formattedDate = new Date(appointment.day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-md mx-auto p-6 text-white space-y-6">
      <div className="bg-[#111827] border border-white/20 rounded-xl p-6 shadow-lg text-center space-y-4">
        <CalendarX className="text-red-400 w-12 h-12 mx-auto" />

        <h1 className="text-2xl font-bold">Cancel Appointment?</h1>

        {status === "success" ? (
          <>
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
            <p className="text-green-400 font-semibold">
              Your booking has been cancelled.
            </p>
            <p className="text-sm text-gray-400">
              Sorry to see you go — hope to see you again soon!
            </p>
          </>
        ) : status === "kept" ? (
          <>
            <CheckCircle className="w-8 h-8 text-blue-400 mx-auto" />
            <p className="text-blue-400 font-semibold">
              Your booking is still active.
            </p>
            <p className="text-sm text-gray-400">
              No changes were made. You’re all set!
            </p>
          </>
        ) : (
          <>
            <p className="text-white text-sm mb-2">
              You’re about to cancel your booking with
            </p>
            <p className="text-lg text-white font-semibold">
              {appointment.freelancer_name}
            </p>

            <hr className="my-2 border-white/20" />

            <div className="text-sm text-purple-300 space-y-1">
              <p>{appointment.service_name}</p>
              <p>📅 {formattedDate}</p>
              <p>
                🕒 {appointment.time} ({appointment.timezone})
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <button
                onClick={handleCancel}
                className="btn btn-error btn-sm w-full"
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Yes, Cancel Appointment"
                )}
              </button>

              <button
                onClick={handleKeep}
                className="text-sm text-gray-400 underline"
              >
                No, Keep My Appointment
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}