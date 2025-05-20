import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";

export default function ClientLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await axios.post("http://127.0.0.1:5000/client-login", {
        email,
        password,
      });
      localStorage.setItem("client_id", res.data.client_id);
      localStorage.setItem("client_logged_in", "true");
      navigate("/client-admin");
    } catch (err) {
      const msg = err.response?.data?.error || "Login failed. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4 text-center">Client Login</h2>
      <form onSubmit={handleLogin} className="space-y-4">
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
        <button className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>

      {error && (
        <div className="alert alert-error mt-4 shadow-sm text-center">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
