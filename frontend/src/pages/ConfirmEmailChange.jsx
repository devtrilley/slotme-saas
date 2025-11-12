import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

export default function ConfirmEmailChange() {
  const [search] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    const token = search.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    (async () => {
      try {
        await axios.post("/auth/change-email/confirm", { token });
        showToast("Email updated. Log in with new email.", "success");
        setStatus("ok");
        localStorage.clear();
      } catch (err) {
        showToast(
          err?.response?.data?.error || "Link invalid or expired.",
          "error"
        );
        setStatus("error");
      }
    })();
  }, []);

  return (
    <main className="max-w-md mx-auto p-8 text-center space-y-6">
      {status === "loading" && (
        <>
          <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
          <h1 className="text-2xl font-bold">Confirming Email Change...</h1>
          <p className="text-gray-400">Please wait a moment</p>
        </>
      )}

      {status === "ok" && (
        <>
          <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
          <h1 className="text-3xl font-bold text-white">Email Updated!</h1>
          <p className="text-purple-300 text-lg">
            Your login email has been successfully changed. You can now log in
            with your new email address.
          </p>
          <button
            className="btn btn-primary w-full mt-4"
            onClick={() => navigate("/auth")}
          >
            Go to Login
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="w-16 h-16 mx-auto text-red-400" />
          <h1 className="text-2xl font-bold text-white">
            Link Invalid or Expired
          </h1>
          <p className="text-gray-400">
            Please request a new email change from your Settings page.
          </p>
          <button
            className="btn btn-outline w-full mt-4"
            onClick={() => navigate("/settings")}
          >
            Back to Settings
          </button>
        </>
      )}
    </main>
  );
}
