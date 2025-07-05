import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { API_BASE } from "../utils/constants";
import { resetSessionFlag } from "../utils/axiosInstance";

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
    setError("");
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const res = await axios.post(`${API_BASE}/signup`, {
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        });

        alert("Thanks for signing up! Please check your email to confirm.");
        setMode("login");
      } else {
        const res = await axios.post(`${API_BASE}/auth`, {
          email,
          password,
        });

        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("freelancer_id", res.data.freelancer_id);
        localStorage.setItem("freelancer_logged_in", "true");

        console.log("✅ Logged in, received token:", res.data.access_token);
        console.log("🧠 Stored freelancer ID:", res.data.freelancer_id);
        console.log(
          "📦 LocalStorage token (immediate check):",
          localStorage.getItem("access_token")
        );

        if (clearSession) clearSession();

        navigate(nextPage);
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Something went wrong.";
      setError(msg);
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
        />
        <input
          type="password"
          className="input input-bordered w-full"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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

      {error && <p className="text-red-500 text-center text-sm">{error}</p>}

      <p className="text-center text-sm text-gray-500 mt-4">
        Customers don’t need to log in. Just book directly from a freelancer’s
        page.
      </p>
    </div>
  );
}
