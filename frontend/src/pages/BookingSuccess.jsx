import { MailCheck, Smile } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import axios from "axios";

export default function BookingSuccess() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get("token");

    if (token) {
      axios
        .get(`http://localhost:5000/confirm-booking/${token}`)
        .then(() => {
          console.log("✅ Booking confirmed.");
        })
        .catch((err) => {
          console.error("❌ Booking confirmation failed:", err);
        });
    }
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      <div className="flex flex-col items-center space-y-2">
        <Smile className="text-green-400 w-12 h-12" />
        <h1 className="text-2xl font-bold">Booking Received!</h1>
        <p className="text-purple-300">
          You're almost done. We sent you an email — click the confirmation link
          to finalize your appointment.
        </p>
      </div>

      <div className="flex flex-col items-center space-y-2 text-sm text-white/60">
        <span>Haven’t received it? Check your spam folder.</span>
        <MailCheck className="w-5 h-5 text-white/60" />
      </div>

      {/* 🔁 Email platform buttons (mapped) */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4 w-full">
        {[
          {
            name: "Gmail",
            url: "https://mail.google.com/",
            logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/2560px-Gmail_icon_%282020%29.svg.png",
          },
          {
            name: "Outlook",
            url: "https://outlook.live.com/mail/",
            logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg/1101px-Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg.png",
          },
          {
            name: "Yahoo",
            url: "https://mail.yahoo.com/",
            logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSaw80OezWQC5DRsT8hpoPGBIgPr2vcYFs5NA&s",
          },
        ].map((platform) => (
          <a
            key={platform.name}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline w-1/2 sm:w-auto flex items-center justify-center px-6 py-3"
          >
            <img
              src={platform.logo}
              alt={platform.name}
              className="w-5 h-5 mr-2"
            />
            {platform.name}
          </a>
        ))}
      </div>

      <button
        onClick={() => navigate("/")}
        className="mt-6 text-sm text-blue-400 hover:underline"
      >
        ← Back to Homepage
      </button>
    </div>
  );
}
