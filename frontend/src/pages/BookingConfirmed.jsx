import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import axios from "../utils/axiosInstance";
import { API_BASE } from "../utils/constants";

export default function BookingConfirmed() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const appointmentId = params.get("appointment_id");

  useEffect(() => {
    if (!appointmentId) return;

    axios
      .get(`${API_BASE}/public-appointment/${appointmentId}`, {
        withCredentials: false,
      })
      .then((res) => {
        setAppointment(res.data);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch appointment", err);
      });
  }, [appointmentId]);

  if (!appointment) {
    return (
      <div className="text-center text-white mt-10">
        Loading confirmation...
      </div>
    );
  }

  const {
    freelancer_name,
    day,
    time,
    timezone,
    service_name,
    business_address,
  } = appointment;

  const formattedDate = new Date(day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="max-w-md mx-auto p-6 text-white space-y-6">
      <section
        className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl p-8 shadow-lg text-center space-y-5 hover:shadow-xl transition-shadow duration-300"
        aria-labelledby="confirmed-heading"
      >
        <header className="space-y-3">
          <CalendarCheck className="text-green-400 w-16 h-16 mx-auto drop-shadow-lg" />
          <h1 id="confirmed-heading" className="text-3xl font-bold">
            Booking Confirmed!
          </h1>
          <p className="text-purple-300 text-base">
            Thank you, {appointment.first_name}!
          </p>
        </header>

        <div className="text-sm leading-relaxed text-gray-300">
          <p>Your appointment with</p>
          <p className="text-xl text-white font-bold mt-1">{freelancer_name}</p>
          <p className="mt-1">has been confirmed.</p>
        </div>

        {/* Divider */}
        <hr className="border-slate-700" />

        {/* Appointment Details - CENTERED LAYOUT */}
        <div className="space-y-2 pt-2">
          <p className="text-xl font-bold text-white">{service_name}</p>
          <p className="text-base text-gray-300">on {formattedDate}</p>
          <p className="text-base text-gray-300">
            at <strong className="text-white">{time}</strong>{" "}
            <span className="text-sm text-gray-400">({timezone})</span>
          </p>

          {business_address && (
            <div className="pt-2 space-y-1">
              <p className="text-sm text-gray-400">Location:</p>
              <p className="text-base text-white">{business_address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  business_address
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-sm hover:underline inline-block mt-1"
              >
                📍 Open in Maps
              </a>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-400 italic pt-2">
          📧 Check your email for full booking details and next steps.
        </p>

        {/* Action Buttons – unified SlotMe pill design */}
        <div className="flex flex-col gap-3 pt-4">
          {/* GOOGLE CALENDAR – matches Resend button design */}
          <a
            href={appointment.calendar_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full"
          >
            📆 Add to Google Calendar
          </a>

          {/* ICS DOWNLOAD – same shape/padding/sizing */}
          <a
            href={`${API_BASE}/download-ics/${appointmentId}`}
            className="w-full flex items-center justify-center gap-2
  px-4 py-2 rounded-md
  bg-blue-500/20 border border-blue-500
  text-white font-medium
  shadow-lg shadow-blue-700/20
  hover:bg-blue-500/30 hover:shadow-blue-600/30
  transition-all duration-200 active:scale-[.98]"
          >
            <span className="text-2xl">📱</span>
            <span className="text-sm text-center leading-tight">
              Download .ics
              <br />
              (Apple / Outlook)
            </span>
          </a>
        </div>
      </section>

      <nav className="text-center mt-6">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-blue-400 hover:underline"
        >
          ← Return to Homepage
        </button>
      </nav>
    </main>
  );
}
