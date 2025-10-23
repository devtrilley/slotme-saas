import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";

export default function ConfirmEmailChange() {
  const [search] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const navigate = useNavigate();

  useEffect(() => {
    const token = search.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    (async () => {
      try {
        const res = await axios.post("/auth/change-email/confirm", { token });
        showToast("✅ Email updated. Please log in with your new email.", "success", 7000);
        setStatus("ok");
        // Hard-logout local state
        localStorage.clear();
      } catch (err) {
        showToast(
          err?.response?.data?.error || "Invalid or expired link.",
          "error",
          7000
        );
        setStatus("error");
      }
    })();
  }, []);

  if (status === "loading") {
    return (
      <div className="max-w-sm mx-auto p-6 text-center">
        <p>Confirming email change…</p>
      </div>
    );
  }

  if (status === "ok") {
    return (
      <div className="max-w-sm mx-auto p-6 text-center space-y-3">
        <h2 className="text-xl font-semibold">Email updated</h2>
        <p>You can now log in with your new email.</p>
        <button className="btn btn-primary w-full" onClick={() => navigate("/auth")}>
          Go to login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto p-6 text-center space-y-3">
      <h2 className="text-xl font-semibold text-error">Link invalid</h2>
      <p>Please start again from Settings → Change Email.</p>
      <button className="btn btn-outline w-full" onClick={() => navigate("/settings")}>
        Back to Settings
      </button>
    </div>
  );
}