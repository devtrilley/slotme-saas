// src/pages/SignupSuccess.jsx
import { MailCheck, ThumbsUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../utils/constants";
import { showToast } from "../utils/toast";
import ResendButton from "../components/Buttons/ResendButton";

export default function SignupSuccess() {
  const navigate = useNavigate();
  const handleResend = async () => {
    const email = localStorage.getItem("pendingEmail");
    if (!email) {
      showToast("No signup email found. Please sign up again.", "error");
      throw new Error("No email");
    }
  
    const res = await axios.post(`${API_BASE}/auth/resend-verification`, {
      email,
    });
  
    if (res.data.message?.includes("already verified")) {
      showToast("Already verified! Redirecting to login...", "success");
      localStorage.removeItem("pendingEmail");
      setTimeout(() => navigate("/auth"), 2000);
      throw new Error("Already verified");
    }
  
    showToast("Verification email resent. Check your inbox!", "success");
  };

  return (
    <main className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      <div className="flex flex-col items-center space-y-2">
        <ThumbsUp className="text-green-400 w-12 h-12" />
        <h1 className="text-2xl font-bold">Welcome to SlotMe!</h1>
        <p className="text-purple-300">
          Your sign-up is almost complete. Check your inbox and click the
          verification link to activate your account. This may take a few
          minutes.
        </p>
      </div>

      <div className="flex flex-col items-center space-y-3 mt-6">
        <div className="flex items-center justify-center space-x-2 text-sm text-white/60">
          <MailCheck className="w-4 h-4 text-white/60" />
          <span>Didn’t get it? Check your spam folder.</span>
        </div>

        <ResendButton onResend={handleResend} cooldownSeconds={60} />
      </div>

      {/* 🔥 Email Platform Quick Links */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 w-full">
        {[
          {
            name: "Gmail",
            url: "https://mail.google.com/",
            logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/2560px-Gmail_icon_%282020%29.svg.png",
          },
          {
            name: "Outlook",
            url: "https://outlook.live.com/mail/",
            logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Microsoft_Office_Outlook_%282018%E2%80%932024%29.svg/1024px-Microsoft_Office_Outlook_%282018%E2%80%932024%29.svg.png?20230309112740",
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
        onClick={() => navigate("/auth")}
        className="mt-6 text-sm text-blue-400 hover:underline"
      >
        ← Go to Login
      </button>
    </main>
  );
}
