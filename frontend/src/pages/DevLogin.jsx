import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";

export default function DevLogin() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    axios
      .post("/dev/login", { password: secret })
      .then((res) => {
        // Clear freelancer session first
        const wasFreelancer = localStorage.getItem("freelancer_logged_in");
        localStorage.removeItem("freelancer_logged_in");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("freelancer_id");
        localStorage.removeItem("branding_updated");
        localStorage.removeItem("client_id");

        if (wasFreelancer) {
          showToast("Logged out as Freelancer", "info");
        }

        // Set dev session
        localStorage.setItem("dev_access_token", res.data.access_token);
        localStorage.setItem("dev_logged_in", "true");

        showToast("Logged in as Dev Admin", "success");
        navigate("/dev-admin");
      })
      .catch(() => {
        setError("Invalid dev password.");
      });
  };

  return (
    <main className="max-w-sm mx-auto mt-10 space-y-6 p-6 bg-base-200 shadow-md rounded-lg">
      <h1 className="text-2xl font-bold text-center">Developer Login</h1>

      {error && <p className="text-center text-red-500">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="Enter Dev Secret"
          className="input input-bordered w-full"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
        />
        <button className="btn btn-primary w-full">Login</button>
      </form>
    </main>
  );
}
