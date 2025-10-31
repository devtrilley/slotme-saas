import { useState } from "react";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      await axios.post("/auth/forgot-password", { email });
      showToast("If that email exists, a reset link was sent.", "info");
    } catch (err) {
      showToast("Couldn't send reset link. Try again.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="max-w-sm mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-center">Forgot Password</h1>
      <p className="text-sm text-gray-400 text-center">
        Enter your email and we’ll send you a reset link.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          className="input input-bordered w-full"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={sending}
        />
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={sending}
        >
          {sending ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </main>
  );
}
