import { useState, useEffect } from "react";
import axios from "../../utils/axiosInstance";
import { showToast } from "../../utils/toast";
import { API_BASE } from "../../utils/constants";
import ConfirmModal from "../Modals/ConfirmModal";

export default function AddonCard({ addon, onUpdate, onDelete }) {
  const { id, name, description, price_usd, duration_minutes, is_enabled } =
    addon;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name,
    description: description || "",
    price_usd: String(price_usd ?? ""),
    duration_minutes: String(duration_minutes ?? "0"),
  });
  const [isEnabled, setEnabled] = useState(() => is_enabled ?? true); // ✅ NEW
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ✅ NEW: Sync state when addon prop changes
  useEffect(() => {
    setEnabled(is_enabled);
  }, [is_enabled]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    const payload = {
      ...form,
      price_usd: parseFloat(form.price_usd) || 0.0,
      duration_minutes: parseInt(form.duration_minutes) || 0,
    };

    setLoading(true);
    axios
      .patch(`${API_BASE}/freelancer/addons/${id}`, payload)
      .then(() => {
        showToast("Add-on updated!", "success");
        setEditing(false);
        if (onUpdate) onUpdate();
      })
      .catch((err) => {
        console.error("❌ Failed to update add-on", err);
        showToast("Update failed. Check connection.", "error");
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = () => {
    if (onDelete) onDelete(id);
  };

  // ✅ ADD THIS NEW FUNCTION:
  const handleToggle = () => {
    const newStatus = !isEnabled;
    axios
      .patch(`${API_BASE}/freelancer/addons/${id}`, { is_enabled: newStatus })
      .then(() => {
        setEnabled(newStatus);
        showToast(`Add-on ${newStatus ? "enabled" : "disabled"}`);
        if (onUpdate) onUpdate(); // Refresh list
      })
      .catch((err) => {
        console.error("❌ Failed to toggle add-on", err);
        showToast("Couldn't toggle add-on. Try again.", "error");
      });
  };

  return (
    <>
      <div className="w-full bg-white/10 backdrop-blur-md rounded-xl px-4 py-4 space-y-2 border border-white/20">
        {editing ? (
          <div className="space-y-2">
            <input
              className="input input-sm input-bordered w-full"
              value={form.name}
              onChange={handleChange("name")}
              placeholder="Add-on name"
            />
            <textarea
              className="textarea textarea-sm textarea-bordered w-full"
              value={form.description}
              onChange={handleChange("description")}
              placeholder="Description (optional)"
            />
            <div className="space-y-2">
              <label className="block text-sm text-gray-300">
                Price (USD):
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input input-xs bg-base-300 text-white w-full"
                value={form.price_usd ?? ""}
                onChange={handleChange("price_usd")}
              />

              <label className="block text-sm text-gray-300">Duration:</label>
              <div className="text-center bg-base-300 rounded-lg p-2">
                <p className="text-white text-sm font-medium">
                  {form.duration_minutes} mins
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-xs btn-error flex-1 text-white font-bold"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      duration_minutes: String(
                        Math.max(0, Number(prev.duration_minutes || 0) - 15)
                      ),
                    }))
                  }
                >
                  − 15
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-success flex-1 text-white font-bold"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      duration_minutes: String(
                        Math.min(480, Number(prev.duration_minutes || 0) + 15)
                      ),
                    }))
                  }
                >
                  + 15
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div>
              <h3 className="font-semibold text-white text-sm">{form.name}</h3>
              {form.description && (
                <p className="text-sm text-gray-300">{form.description}</p>
              )}
            </div>
            <div className="mt-auto space-y-1">
              <p className="text-xs text-green-400 font-semibold">
                +${parseFloat(form.price_usd || 0).toFixed(2)}
              </p>
              {parseInt(form.duration_minutes) > 0 && (
                <p className="text-xs text-gray-400">
                  +{form.duration_minutes} mins
                </p>
              )}
              {!isEnabled && (
                <p className="text-xs text-red-400 font-medium">Disabled</p>
              )}
            </div>
          </div>
        )}

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
                    description: description || "",
                    price_usd: String(price_usd ?? ""),
                    duration_minutes: String(duration_minutes ?? "0"),
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirm(true);
            }}
            className="btn btn-xs btn-error hover:brightness-110 transition-all"
          >
            Delete
          </button>
          <button
            onClick={handleToggle}
            className={`btn btn-xs ${isEnabled ? "btn-warning" : "btn-accent"}`}
          >
            {isEnabled ? "Disable" : "Enable"}
          </button>
        </div>

        <ConfirmModal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleDelete}
          message="Are you sure you want to delete this add-on?"
          confirmText="Delete"
          cancelText="Keep Add-On"
          serviceCardElement={
            <div className="text-left text-sm text-gray-300 space-y-1">
              <p className="font-semibold text-white">{form.name}</p>
              {form.description && <p>{form.description}</p>}
              <p className="text-xs text-green-400 font-semibold">
                +${parseFloat(form.price_usd || 0).toFixed(2)}
              </p>
              {parseInt(form.duration_minutes) > 0 && (
                <p className="text-xs text-gray-400">
                  +{form.duration_minutes} mins
                </p>
              )}
            </div>
          }
        />
      </div>
    </>
  );
}
