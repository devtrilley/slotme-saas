// ServiceForm.jsx
import { useState } from "react";
import axios from "axios";
import { showToast } from "../utils/toast";

export default function ServiceForm({ onServiceAdded }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    axios
      .post("http://127.0.0.1:5000/freelancer/services", {
        name,
        description,
        duration_minutes: duration,
        price_usd: price,
      }, {
        headers: { "X-Freelancer-ID": localStorage.getItem("freelancer_id") },
      })
      .then(() => {
        showToast("Service added!");
        setName("");
        setDescription("");
        setDuration(60);
        setPrice(0);
        if (onServiceAdded) onServiceAdded();
      })
      .catch((err) => {
        console.error("❌ Failed to add service", err);
        showToast("Failed to add service", "error");
      })
      .finally(() => setLoading(false));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-bold text-center text-md">Add a New Service</h3>
      <input
        className="input input-bordered w-full"
        placeholder="Service name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <textarea
        className="textarea textarea-bordered w-full"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <input
        className="input input-bordered w-full"
        type="number"
        placeholder="Duration (minutes)"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        required
      />
      <input
        className="input input-bordered w-full"
        type="number"
        step="0.01"
        placeholder="Price (USD)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
      />
      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Service"}
      </button>
    </form>
  );
}