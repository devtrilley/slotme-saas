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
      showToast("Passwords don't match.", "warning");
      setSubmitting(false);
      return;
    }
    try {
      await axios.post("/auth/reset-password", {
        token,
        new_password: password,
      });
      showToast("Password reset. You can log in now.", "success");
      setTimeout(() => navigate("/auth"), 2000);
    } catch (err) {
      showToast("Link invalid or expired.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-sm mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-center">Reset Password</h1>
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
        {showChecklist && (
          <PasswordChecklist password={password} confirmPassword={confirm} />
        )}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={submitting}
        >
          {submitting ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </main>
  );
}
