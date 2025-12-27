import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFreelancer } from "../context/FreelancerContext";
import axios, { resetSessionFlag } from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import { validatePassword } from "../utils/validatePassword";
import PasswordChecklist from "../components/Inputs/PasswordChecklist";

export default function Auth({ clearSession }) {
  const { clearFreelancer } = useFreelancer();
  const [mode, setMode] = useState("login");
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
          showToast("Password doesn't meet requirements.", "error");
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

        // ✅ Save email for resend button AFTER signup
        localStorage.setItem("pendingEmail", cleanEmail);

        showToast("Verification email sent. Check inbox.", "success");
        navigate("/signup-success");
      } else {
        const res = await axios.post(`/auth`, {
          email: cleanEmail,
          password,
        });

        // Clear dev session first
        const wasDev = localStorage.getItem("dev_logged_in");
        localStorage.removeItem("dev_logged_in");
        localStorage.removeItem("dev_access_token");

        if (wasDev) {
          showToast("Logged out as Dev Admin", "info");
        }

        // ✅ Clear old freelancer data BEFORE storing new login
        clearFreelancer();

        // 🔒 Store BOTH tokens after successful login
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token);
        localStorage.setItem("freelancer_id", res.data.freelancer_id);
        localStorage.setItem("freelancer_logged_in", "true");

        if (clearSession) clearSession();

        showToast("Logged in as Freelancer", "success");
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
        showToast("Email not verified. Check inbox or resend.", "warning");
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
      showToast("Verification email sent. Check inbox.", "success");
      setShowResendButton(false);
    } catch (err) {
      showToast("Couldn't resend. Try again in a moment.", "error");
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
    <main
      role="main"
      className="max-w-sm mx-auto p-6 space-y-6"
      aria-labelledby="auth-heading"
    >
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

      <header className="text-center space-y-1">
        <h1
          id="auth-heading"
          className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
        >
          {mode === "login" ? "Log In to" : "Sign Up for"} SlotMe
        </h1>
        <p className="text-sm text-gray-400">Freelancer access only</p>
      </header>

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
            <div>
              <label className="label">
                <span className="label-text">First Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="e.g. John"
                value={firstName}
                onChange={(e) =>
                  setFirstName(
                    e.target.value.charAt(0).toUpperCase() +
                      e.target.value.slice(1).toLowerCase()
                  )
                }
                required
              />
            </div>
            <div>
              <label className="label">
                <span className="label-text">Last Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="e.g. Smith"
                value={lastName}
                onChange={(e) =>
                  setLastName(
                    e.target.value.charAt(0).toUpperCase() +
                      e.target.value.slice(1).toLowerCase()
                  )
                }
                required
              />
            </div>
          </>
        )}
        <div>
          <label className="label">
            <span className="label-text">Email</span>
          </label>
          <input
            type="email"
            className="input input-bordered w-full"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        {/* Password Input */}
        <div className="space-y-1">
          <label className="label">
            <span className="label-text">Password</span>
          </label>
          <input
            type="password"
            className="input input-bordered w-full"
            placeholder="Enter password"
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
              <label className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="Re-enter password"
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

      <footer className="text-center text-sm text-gray-500 mt-4">
        <p>
          Customers don’t need to log in. Just book directly from a freelancer’s
          page.
        </p>
      </footer>
    </main>
  );
}
