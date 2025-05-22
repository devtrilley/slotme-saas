// AddSlotForm.jsx
// This is a React component that lets freelancers add new time slots to their availability.

import { useState } from "react";
import axios from "axios";
import { showToast } from "../utils/toast";

export default function AddSlotForm({ onAdd }) {
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    axios
      .post(
        "http://127.0.0.1:5000/slots",
        { time },
        {
          headers: {
            "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
          },
        }
      )
      .then((res) => {
        showToast("Time slot added!");
        setTime("");
        if (onAdd) onAdd();

        // Optional: re-focus the input for fast re-entry
        document.querySelector("input[type='text']").focus();
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Failed to add slot";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-md font-bold text-center">Add a New Time Slot</h3>
      <input
        type="text"
        className="input input-bordered w-full"
        placeholder="e.g. 10:30 AM"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        required
      />

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Slot"}
      </button>
    </form>
  );
}
