// This is a lightweight login screen that sets a flag in localStorage if your credentials match

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function DevLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    // TODO: Change to your actual credentials
    const validEmail = "admin@example.com";
    const validPass = "password123";

    if (email === validEmail && pass === validPass) {
      localStorage.setItem("isDevAdmin", "true");
      navigate("/admin");
    } else {
      setError("Invalid credentials.");
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 space-y-6 p-6 bg-base-200 shadow-md rounded-lg">
      <h2 className="text-2xl font-bold text-center">Developer Login</h2>

      {error && <p className="text-center text-red-500">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="input input-bordered w-full"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />

        <button className="btn btn-primary w-full">Login</button>
      </form>
    </div>
  );
}