import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function ClientLogin() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (code === "client123") {
      localStorage.setItem("client_logged_in", "true");
      navigate("/client-admin");
    } else {
      alert("Invalid code");
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4 text-center">Client Login</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="Enter client access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn btn-primary w-full">Login</button>
      </form>
    </div>
  );
}