import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Auth() {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        const res = await axios.post("http://127.0.0.1:5000/auth", {
          email,
          password,
        });

        localStorage.setItem("freelancer_logged_in", "true");
        localStorage.setItem("freelancer_id", res.data.freelancer_id);
        navigate("/freelancer-admin");
      } else {
        const res = await axios.post(
          "http://127.0.0.1:5000/dev/freelancers",
          {
            name,
            email,
            password,
          },
          {
            headers: { "X-Dev-Auth": "secret123" },
          }
        );

        alert("Freelancer account created! You can now log in.");
        setMode("login");
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Something went wrong.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* Auth Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
