import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import PasswordChecklist from "../components/Inputs/PasswordChecklist";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    if (password !== confirm) {
      showToast("❌ Passwords do not match.", "error");
      setSubmitting(false);
      return;
    }
    try {
      await axios.post("/auth/reset-password", { token, new_password: password });
      showToast("✅ Password reset successful. You can now log in.", "success");
      setTimeout(() => navigate("/auth"), 2000);
    } catch (err) {
      showToast("❌ Invalid or expired link.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-center">Reset Password</h2>
      <form onSubmit={handleReset} className="space-y-4">
        <input
          type="password"
          className="input input-bordered w-full"
          placeholder="New Password"
          value={password}
          onFocus={() => setShowChecklist(true)}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="input input-bordered w-full"
          placeholder="Confirm Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {showChecklist && <PasswordChecklist password={password} confirmPassword={confirm} />}
        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}