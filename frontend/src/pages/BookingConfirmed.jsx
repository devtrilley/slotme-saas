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
        withCredentials: false, // 👈 prevent accidental token sending
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
        className="bg-[#111827] border border-white/20 rounded-xl p-6 shadow-lg text-center space-y-4"
        aria-labelledby="confirmed-heading"
      >
        <header>
          <CalendarCheck className="text-green-400 w-12 h-12 mx-auto" />
          <h1 id="confirmed-heading" className="text-2xl font-bold">
            Booking Confirmed!
          </h1>
        </header>
        <p className="text-white text-sm mb-2">
          Thank you, {appointment.first_name}!
        </p>

        <div className="text-sm leading-tight text-purple-300">
          <p>Your appointment with</p>
          <p className="text-lg text-white font-semibold mt-0.5">
            {freelancer_name}
          </p>
          <p className="mt-0.5">has been confirmed.</p>
        </div>

        {/* Divider */}
        <hr className="my-2 border-white/20" />

        <div className="mt-4 space-y-1">
          <p className="text-lg font-medium">{service_name}</p>
          <p className="text-gray-300">on {formattedDate}</p>
          <p className="text-gray-300">
            at <strong className="text-white">{time}</strong> ({timezone})
          </p>
          {business_address && (
            <p className="text-gray-400 text-sm">
              Location: <span className="italic">{business_address}</span>
            </p>
          )}
        </div>

        <p className="text-sm text-gray-400 italic mt-2">
          📧 Check your email for full booking details and next steps.
        </p>

        <a
          href={appointment.calendar_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm btn-outline mt-4"
        >
          📆 Add to Google Calendar
        </a>

        <a
          href={`${API_BASE}/download-ics/${appointmentId}`}
          className="btn btn-sm btn-outline mt-2"
        >
          📄 Download .ics (Apple/Outlook)
        </a>
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
