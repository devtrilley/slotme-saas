import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";

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
        localStorage.setItem("dev_access_token", res.data.access_token);
        localStorage.setItem("dev_logged_in", "true");
        navigate("/dev-admin");
      })
      .catch(() => {
        setError("Invalid dev password.");
      });
  };

  return (
    <div className="max-w-sm mx-auto mt-10 space-y-6 p-6 bg-base-200 shadow-md rounded-lg">
      <h2 className="text-2xl font-bold text-center">Developer Login</h2>

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
    </div>
  );
}
