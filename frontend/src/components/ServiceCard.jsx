import { useState, useEffect } from "react";
import axios from "axios";
import { showToast } from "../utils/toast";

export default function ServiceCard({
  id,
  name,
  description,
  duration_minutes,
  price_usd,
  is_enabled,
  onUpdate,
  isPublicView = false,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name,
    description,
    duration_minutes: String(duration_minutes ?? ""),
    price_usd: String(price_usd ?? ""),
  });
  const [isEnabled, setEnabled] = useState(() => is_enabled ?? true);

  useEffect(() => {
    setEnabled(is_enabled);
  }, [is_enabled]);

  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    const payload = {
      ...form,
      duration_minutes: parseInt(form.duration_minutes) || 0,
      price_usd: parseFloat(form.price_usd) || 0.0,
    };

    setLoading(true);
    axios
      .patch(`http://127.0.0.1:5000/freelancer/services/${id}`, payload, {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
        },
      })
      .then(() => {
        showToast("Service updated!");
        setEditing(false);
        onUpdate?.();
      })
      .catch((err) => {
        console.error("❌ Failed to update service", err);
        showToast("Update failed", "error");
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    axios
      .delete(`http://127.0.0.1:5000/freelancer/services/${id}`, {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
        },
      })
      .then(() => {
        showToast("Service deleted");
        onUpdate?.();
      })
      .catch((err) => {
        console.error("❌ Failed to delete service", err);
        showToast("Delete failed", "error");
      });
  };

  const handleToggle = () => {
    const newStatus = !isEnabled;
    axios
      .patch(
        `http://127.0.0.1:5000/freelancer/services/${id}`,
        { is_enabled: newStatus },
        {
          headers: {
            "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
          },
        }
      )
      .then(() => {
        setEnabled(newStatus);
        showToast(`Service ${newStatus ? "enabled" : "disabled"}`);
        onUpdate?.();
      })
      .catch((err) => {
        console.error("❌ Failed to toggle service", err);
        showToast("Toggle failed", "error");
      });
  };

  return (
    <li className="bg-white/10 backdrop-blur-md rounded-lg px-4 py-4 border border-white/20 list-none space-y-2">
      {editing ? (
        <div className="space-y-2">
          <input
            className="input input-sm input-bordered w-full"
            value={form.name}
            onChange={handleChange("name")}
          />
          <textarea
            className="textarea textarea-sm textarea-bordered w-full"
            value={form.description}
            onChange={handleChange("description")}
          />
          <div className="space-y-1 text-sm text-gray-400">
            <label className="block">Duration:</label>
            <input
              type="number"
              className="input input-xs bg-white text-black w-full"
              value={form.duration_minutes ?? ""}
              onChange={handleChange("duration_minutes")}
            />

            <label className="block">Price:</label>
            <input
              type="number"
              className="input input-xs bg-white text-black w-full"
              value={form.price_usd ?? ""}
              onChange={handleChange("price_usd")}
            />
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-semibold text-white text-sm">{form.name}</h3>
          <p className="text-sm text-gray-300">{form.description}</p>
          <p className="text-xs text-gray-400">
            Duration: {form.duration_minutes} mins
          </p>
          <p className="text-xs text-green-400">
            ${parseFloat(form.price_usd || 0).toFixed(2)}
          </p>
          {!isEnabled && (
            <p className="text-xs text-red-400 font-medium">Disabled</p>
          )}
        </>
      )}

      {!isPublicView && (
        <div className="flex flex-wrap gap-2 mt-3">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={loading}
                className="btn btn-xs btn-success"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setForm({
                    name,
                    description,
                    duration_minutes: String(duration_minutes ?? ""),
                    price_usd: String(price_usd ?? ""),
                  });
                  setEditing(false);
                }}
                className="btn btn-xs btn-outline"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="btn btn-xs btn-outline"
            >
              Edit
            </button>
          )}
          <button onClick={handleDelete} className="btn btn-xs btn-error">
            Delete
          </button>
          <button
            onClick={handleToggle}
            className={`btn btn-xs ${isEnabled ? "btn-warning" : "btn-accent"}`}
          >
            {isEnabled ? "Disable" : "Enable"}
          </button>
        </div>
      )}
    </li>
  );
}
