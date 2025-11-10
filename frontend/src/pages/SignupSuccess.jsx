// src/pages/SignupSuccess.jsx
import { MailCheck, ThumbsUp, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../utils/constants";
import { showToast } from "../utils/toast"; // ✅ use SlotMe's toast

export default function SignupSuccess() {
  const navigate = useNavigate();
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // countdown for resend delay
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isSending) return;
    const email = localStorage.getItem("pendingEmail");
    if (!email) {
      showToast("No signup email found. Please sign up again.", "error");
      return;
    }

    setIsSending(true);
    try {
      await axios.post(`${API_BASE}/auth/resend-verification`, { email });
      showToast("Verification email resent. Check your inbox!", "success");
      setCooldown(60);
    } catch (err) {
      console.error(err);
      showToast("Failed to resend. Try again shortly.", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      <div className="flex flex-col items-center space-y-2">
        <ThumbsUp className="text-green-400 w-12 h-12" />
        <h1 className="text-2xl font-bold">Welcome to SlotMe!</h1>
        <p className="text-purple-300">
          Your sign-up is almost complete. Check your inbox and click the
          verification link to activate your account.
        </p>
      </div>

      <div className="flex flex-col items-center space-y-3 mt-6">
        <div className="flex items-center justify-center space-x-2 text-sm text-white/60">
          <MailCheck className="w-4 h-4 text-white/60" />
          <span>Didn’t get it? Check your spam folder.</span>
        </div>

        <button
          onClick={handleResend}
          disabled={cooldown > 0 || isSending}
          className={`btn btn-primary w-full ${
            cooldown > 0 || isSending ? "btn-disabled opacity-70" : ""
          }`}
        >
          <RefreshCcw className="w-4 h-4" />
          {isSending
            ? "Resending..."
            : cooldown > 0
            ? `Try again in ${cooldown}s`
            : "Resend Verification Email"}
        </button>
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
