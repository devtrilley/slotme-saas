// src/pages/EmailConfirmed.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";

export default function EmailConfirmed() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    (async () => {
      try {
        await axios.get(`/auth/verify-email`, { params: { token } });
        setStatus("success");
        setMessage("Email confirmed! You can now log in.");
        showToast("✅ Email confirmed — you can log in now.", "success");
        // optional auto-redirect after 2s:
        setTimeout(() => navigate("/auth"), 2000);
      } catch (err) {
        const msg =
          err.response?.data?.error ||
          "Verification failed. Try the link again.";
        setStatus("error");
        setMessage(msg);
        showToast(msg, "error");
      }
    })();
  }, [location.search, navigate]);

  return (
    <div className="max-w-sm mx-auto p-8 text-center space-y-4">
      {status === "loading" && (
        <>
          <div className="loading loading-spinner loading-lg mx-auto" />
          <p className="text-sm opacity-80">{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold">Email Confirmed!</h1>
          <p className="opacity-80">{message}</p>
          <Link to="/auth" className="btn btn-primary mt-4">
            Go to Login
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <div className="text-5xl">❌</div>
          <h1 className="text-2xl font-bold">Verification Error</h1>
          <p className="opacity-80">{message}</p>
          <Link to="/auth" className="btn btn-outline mt-4">
            Back to Login
          </Link>
        </>
      )}
    </div>
  );
}
