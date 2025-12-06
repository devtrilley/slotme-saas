import { MailCheck, Smile } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import { API_BASE } from "../utils/constants";
import ResendButton from "../components/Buttons/ResendButton";

export default function BookingSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const appointmentId = searchParams.get("appointment_id");

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      axios
        .get(`${import.meta.env.VITE_API_BASE}/confirm-booking/${token}`)
        .catch((err) => {
          console.error("❌ Booking confirmation failed:", err);
        });
    }
  }, [location.search]);

  const handleResend = async () => {
    if (!appointmentId) {
      showToast("Appointment ID missing. Please try booking again.", "error");
      throw new Error("No appointment ID");
    }

    await axios.post(`${API_BASE}/resend-confirmation/${appointmentId}`);
    showToast("Confirmation email resent! Check your inbox.", "success");
  };

  return (
    <main className="max-w-md mx-auto p-6 space-y-6 text-white">
      <section
        className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl p-8 shadow-lg text-center space-y-5 hover:shadow-xl transition-shadow duration-300"
        aria-labelledby="booking-success-heading"
      >
        <header className="space-y-3">
          <Smile className="text-green-400 w-16 h-16 mx-auto drop-shadow-lg" />
          <h1 id="booking-success-heading" className="text-3xl font-bold">
            Booking Received!
          </h1>
          <p className="text-purple-300 text-base leading-relaxed">
            You're almost done. We sent you an email — click the confirmation
            link to finalize your appointment.
          </p>
        </header>

        <div className="flex flex-col items-center space-y-2 text-sm text-gray-400 pt-2">
          <MailCheck className="w-6 h-6 text-gray-400" />
          <span>Haven't received it? Check your spam folder.</span>
        </div>

        {/* Resend Button */}
        {appointmentId && (
          <div className="w-full mt-4">
            <ResendButton onResend={handleResend} cooldownSeconds={60} />
          </div>
        )}

        {/* 📫 Email Providers – compact square pills */}
        <div className="grid grid-cols-3 gap-3 mt-6 w-full">
          {[
            {
              name: "Gmail",
              url: "https://mail.google.com/",
              logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/2560px-Gmail_icon_%282020%29.svg.png",
            },
            {
              name: "Outlook",
              url: "https://outlook.live.com/mail/",
              logo: "https://www.vectorlogo.zone/logos/microsoft/microsoft-icon.svg",
            },
            {
              name: "Yahoo",
              url: "https://mail.yahoo.com/",
              logo: "https://www.vectorlogo.zone/logos/yahoo/yahoo-icon.svg",
            },
          ].map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center 
                 gap-1 p-2 rounded-lg 
                 bg-slate-800/60 border border-slate-700 
                 hover:bg-slate-800 hover:border-purple-500/40
                 transition-all duration-150"
            >
              <img src={p.logo} alt={p.name} className="w-6 h-6" />
              <span className="text-[10px] text-gray-300">{p.name}</span>
            </a>
          ))}
        </div>
      </section>

      <nav className="mt-6 text-center">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-blue-400 hover:underline"
        >
          ← Back to Homepage
        </button>
      </nav>
    </main>
  );
}
