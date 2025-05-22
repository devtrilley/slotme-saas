import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function NewFreelancer() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    axios
      .post("http://127.0.0.1:5000/dev/freelancers", form, {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then(() => {
        setSuccess("Freelancer created!");
        setTimeout(() => navigate("/dev-admin"), 1000);
      })
      .catch((err) => {
        console.error("❌ Failed to create freelancer", err);
        setError(err.response?.data?.error || "Error creating freelancer");
      });
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">Add New Freelancer</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="name"
          placeholder="Freelancer Name"
          value={form.name}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Freelancer Email"
          value={form.email}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Freelancer Password"
          value={form.password}
          onChange={handleChange}
          className="input input-bordered w-full"
          required
        />
        <button className="btn btn-primary w-full">Create Freelancer</button>
      </form>

      {error && <p className="text-red-500 text-center">{error}</p>}
      {success && <p className="text-green-500 text-center">{success}</p>}

      <button
        onClick={() => navigate("/dev-admin")}
        className="btn btn-outline w-full mt-4"
      >
        ⬅ Back to Admin Panel
      </button>
    </div>
  );
}