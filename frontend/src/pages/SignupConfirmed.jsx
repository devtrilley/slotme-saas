import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function SignupConfirmed() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
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
        setMessage("Your account is officially confirmed!");
        showToast("Email confirmed! You can now log in.", "success");
        // ✅ No auto-redirect - let user click button themselves
      } catch (err) {
        const msg =
          err.response?.data?.error ||
          "Verification failed. The link may be expired.";
        setStatus("error");
        setMessage(msg);
      }
    })();
  }, [location.search, navigate]);

  return (
    <main className="max-w-md mx-auto p-8 text-center space-y-6">
      {status === "loading" && (
        <>
          <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
          <h1 className="text-2xl font-bold">Verifying Email...</h1>
          <p className="text-gray-400">{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
          <h1 className="text-3xl font-bold text-white">Email Confirmed!</h1>
          <p className="text-purple-300 text-lg">
            {message} You can now log in and start using SlotMe.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="btn btn-primary mt-4 w-full"
          >
            Go to Login
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="w-16 h-16 mx-auto text-red-400" />
          <h1 className="text-2xl font-bold text-white">Verification Error</h1>
          <p className="text-gray-400">{message}</p>
          <button
            onClick={() => navigate("/auth")}
            className="btn btn-outline mt-4 w-full"
          >
            Back to Login
          </button>
        </>
      )}
    </main>
  );
}
