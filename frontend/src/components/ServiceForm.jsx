import { useState } from "react";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import { API_BASE } from "../utils/constants";

export default function ServiceForm({ onServiceAdded }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("15");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    if (loading) return; // prevent double submit

    e.preventDefault();
    const token = localStorage.getItem("access_token");
    if (!token) {
      showToast("Please log in to add a service.", "error");
      return;
    }

    setLoading(true);
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const minutes = Number(duration);
    const priceVal = Number(price);

    if (
      !trimmedName ||
      !trimmedDescription ||
      isNaN(minutes) ||
      isNaN(priceVal)
    ) {
      showToast("Please enter valid values for all fields.", "error");
      setLoading(false);
      return;
    }

    axios
      .post(`${API_BASE}/freelancer/services`, {
        name: trimmedName,
        description: trimmedDescription,
        duration_minutes: minutes,
        price_usd: priceVal,
      })
      .then(() => {
        showToast("Service added!");
        setName("");
        setDescription("");
        setDuration("");
        setPrice("");
        if (onServiceAdded) onServiceAdded();
      })
      .catch((err) => {
        console.warn("🔥 Full error response:", err.response?.data);
        console.error("❌ Failed to add service", err);
        showToast("Failed to add service", "error");
      })
      .finally(() => setLoading(false));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-bold text-center text-md">Add a New Service</h3>

      {/* Service Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Service Name</label>
        <input
          className="input input-bordered w-full"
          placeholder="e.g. Haircut"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          className="textarea textarea-bordered w-full"
          placeholder="Brief description of the service"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Duration (minutes, 15 min increments)
        </label>
        <input
          className="input input-bordered w-full text-center"
          type="number"
          step={15}
          min={15}
          placeholder="e.g. 60"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
        />

        {/* Buttons for mobile */}
        <div className="flex justify-center gap-2 mt-2 sm:hidden">
          <div className="flex gap-2 sm:hidden w-full">
            <button
              type="button"
              className="btn btn-sm btn-error flex-1 text-white font-bold"
              onClick={() =>
                setDuration((prev) => Math.max(15, Number(prev || 15) - 15))
              }
            >
              − 15
            </button>
            <button
              type="button"
              className="btn btn-sm btn-success flex-1 text-white font-bold"
              onClick={() =>
                setDuration((prev) => Math.min(360, Number(prev || 15) + 15))
              }
            >
              + 15
            </button>
          </div>
        </div>
      </div>

      {/* Price */}
      <div>
        <label className="block text-sm font-medium mb-1">Price (USD)</label>
        <input
          className="input input-bordered w-full"
          type="number"
          step="0.01"
          min={0}
          placeholder="e.g. 25.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </div>

      {/* Submit */}
      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Service"}
      </button>
    </form>
  );
}
