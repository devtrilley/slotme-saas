import { useState } from "react";
import axios from "../../utils/axiosInstance";
import { showToast } from "../../utils/toast";
import { API_BASE } from "../../utils/constants";

export default function AddonForm({ onAddonAdded }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("0");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    if (loading) return;
    e.preventDefault();

    const token = localStorage.getItem("access_token");
    if (!token) {
      showToast("Log in to add add-ons.", "warning");
      return;
    }

    setLoading(true);

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const priceVal = Number(price);
    const durationVal = Number(duration);

    if (!trimmedName || isNaN(priceVal) || isNaN(durationVal)) {
      showToast("Fill in all fields correctly.", "warning");
      setLoading(false);
      return;
    }

    showToast("Adding add-on...", "info");

    axios
      .post(`${API_BASE}/freelancer/addons`, {
        name: trimmedName,
        description: trimmedDescription,
        price_usd: priceVal,
        duration_minutes: durationVal,
      })
      .then(() => {
        showToast("Add-on created!", "success");
        setName("");
        setDescription("");
        setPrice("");
        setDuration("0");
        if (onAddonAdded) onAddonAdded();
      })
      .catch((err) => {
        console.error("❌ Failed to add add-on", err);
        
        // ✅ Handle tier limit errors (403)
        if (err.response?.status === 403) {
          const errorData = err.response.data;
          const tierRequired = errorData.tier_required;
          
          showToast(
            <span>
              {errorData.error}{" "}
              <a 
                href={`/upgrade#elite?need=${tierRequired}`}
                className="underline font-medium"
              >
                Upgrade →
              </a>
            </span>,
            "error",
            5000 // Show longer for tier errors
          );
        } else {
          // Generic error for other issues
          showToast("Couldn't add add-on. Try again.", "error");
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-bold text-center text-md">Create an Add-On</h3>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Add-On Name</label>
        <input
          className="input input-bordered w-full"
          placeholder="e.g. Hot Towel Treatment"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Description (optional)
        </label>
        <textarea
          className="textarea textarea-bordered w-full"
          placeholder="Brief description (500 char limit)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Price */}
      <div>
        <label className="block text-sm font-medium mb-1">Price (USD)</label>
        <input
          className="input input-bordered w-full"
          type="number"
          step="0.01"
          min={0}
          placeholder="e.g. 5.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Extra Duration (optional, 15 min increments)
        </label>
        <input
          className="input input-bordered w-full text-center"
          type="text"
          value={`${duration} minutes`}
          readOnly
        />
        <div className="flex justify-center gap-2 mt-2">
          <div className="flex gap-2 w-full">
            <button
              type="button"
              className="btn btn-sm btn-error flex-1 text-white font-bold"
              onClick={() =>
                setDuration((prev) => Math.max(0, Number(prev || 0) - 15))
              }
            >
              − 15
            </button>
            <button
              type="button"
              className="btn btn-sm btn-success flex-1 text-white font-bold"
              onClick={() =>
                setDuration((prev) => Math.min(480, Number(prev || 0) + 15))
              }
            >
              + 15
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1 text-center">
          Set to 0 if this add-on doesn't need extra time
        </p>
      </div>

      {/* Submit */}
      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Adding..." : "Create Add-On"}
      </button>
    </form>
  );
}
