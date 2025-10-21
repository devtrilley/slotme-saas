import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios, { resetSessionFlag } from "../utils/axiosInstance";
import { showToast } from "../utils/toast";

export default function Auth({ clearSession }) {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        localStorage.setItem("refresh_token", res.data.refresh_token);  // ✅ NEW
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
        showToast("Email not verified — check your inbox.", "error");
      } else {
        showToast(msg, "error");
      }
    } finally {
      setSubmitting(false);
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
        <input
          type="password"
          className="input input-bordered w-full"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={submitting}
        />
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
      </form>

      {/* {error && <p className="text-red-500 text-center text-sm">{error}</p>} */}

      <p className="text-center text-sm text-gray-500 mt-4">
        Customers don’t need to log in. Just book directly from a freelancer’s
        page.
      </p>
    </div>
  );
}
