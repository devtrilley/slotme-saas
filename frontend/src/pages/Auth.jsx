import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios, { resetSessionFlag } from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import { validatePassword } from "../utils/validatePassword";
import PasswordChecklist from "../components/Inputs/PasswordChecklist";

export default function Auth({ clearSession }) {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPasswordChecklist, setShowPasswordChecklist] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const nextPage = params.get("next") || "/freelancer-admin";
  const showSessionExpired = location.state?.sessionExpired === true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // 🚫 stop double submits
    setError("");
    setSubmitting(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (mode === "signup") {
        const { valid } = validatePassword(password);
        if (!valid) {
          showToast("❌ Weak password. Please meet all requirements.", "error");
          setError("Please meet all password requirements before continuing.");
          setSubmitting(false);
          return;
        }

        await axios.post(`/auth/signup`, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: cleanEmail,
          password,
        });

        showToast("Check your inbox to verify your email.", "success");
        navigate("/signup-success");
      } else {
        const res = await axios.post(`/auth`, {
          email: cleanEmail,
          password,
        });

        // 🔐 Store BOTH tokens after successful login
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token); // ✅ NEW
        localStorage.setItem("freelancer_id", res.data.freelancer_id);
        localStorage.setItem("freelancer_logged_in", "true");

        if (clearSession) clearSession();

        navigate(nextPage);
      }
    } catch (err) {
      const status = err.response?.status;
      let msg = err.response?.data?.error;

      if (!msg) {
        msg =
          status === 500
            ? "Signup failed on our side. Please try again in a moment."
            : "Something went wrong.";
      }

      setError(msg);

      if (status === 403) {
        setShowResendButton(true);
        showToast("Email not verified — check your inbox.", "error");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (resending) return;
    setResending(true);

    try {
      await axios.post(`/auth/resend-verification`, {
        email: email.trim().toLowerCase(),
      });
      showToast("✅ Verification email sent! Check your inbox.", "success");
      setShowResendButton(false);
    } catch (err) {
      showToast("Failed to resend email. Try again.", "error");
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (showSessionExpired) {
      resetSessionFlag(); // Only reset, no toast from page itself
    }
  }, [showSessionExpired]);

  return (
    <div className="max-w-sm mx-auto p-6 space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-center gap-4">
        <button
          className={`btn btn-sm ${
            mode === "signup" ? "btn-primary" : "btn-outline"
          }`}
          onClick={() => setMode("signup")}
        >
          Sign Up
        </button>
        <button
          className={`btn btn-sm ${
            mode === "login" ? "btn-primary" : "btn-outline"
          }`}
          onClick={() => setMode("login")}
        >
          Log In
        </button>
      </div>

      <h2 className="text-2xl font-bold text-center">
        {mode === "login" ? "Log In to" : "Sign Up for"} SlotMe as a Freelancer
      </h2>

      {showSessionExpired && (
        <div className="alert alert-error shadow-lg text-center">
          🔒 Your session expired for security reasons. No worries — please log
          in to continue.
        </div>
      )}

      {/* Auth Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </>
        )}
        <input
          type="email"
          className="input input-bordered w-full"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={submitting}
        />
        {/* Password Input */}
        <div className="space-y-1">
          <input
            type="password"
            className="input input-bordered w-full"
            placeholder="Password"
            value={password}
            onFocus={() => setShowPasswordChecklist(true)}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => {
              if (password.length === 0 && confirmPassword.length === 0)
                setShowPasswordChecklist(false);
            }}
            required
            disabled={submitting}
          />

          {mode === "signup" && (
            <>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={submitting}
              />
              {/* ✅ Inline password requirements */}
              {showPasswordChecklist && (
                <PasswordChecklist
                  password={password}
                  confirmPassword={confirmPassword}
                />
              )}
            </>
          )}
        </div>
        <button
  type="submit"
  className="btn btn-primary w-full"
  disabled={submitting}
>
  {submitting
    ? mode === "login"
      ? "Logging in..."
      : "Signing up..."
    : mode === "login"
    ? "Log In"
    : "Sign Up"}
</button>

{/* 🧠 Only show Forgot Password link in login mode */}
{mode === "login" && (
  <p className="text-center text-sm mt-2">
    <button
      type="button"
      onClick={() => navigate("/forgot-password")}
      className="text-blue-400 underline hover:text-blue-300 transition"
    >
      Forgot password?
    </button>
  </p>
)}
      </form>

      {showResendButton && (
        <div className="alert alert-error shadow-lg">
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-sm text-center">
              ❌ Email not verified — check your inbox.
            </p>
            <button
              onClick={handleResendVerification}
              className="btn btn-sm btn-outline btn-error"
              disabled={resending}
            >
              {resending ? "Sending..." : "📧 Resend Verification Email"}
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-gray-500 mt-4">
        Customers don’t need to log in. Just book directly from a freelancer’s
        page.
      </p>
    </div>
  );
}
