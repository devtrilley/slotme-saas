import { useState } from "react";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import IconDatePicker from "./IconDatePicker";
import { DateTime } from "luxon";
import { API_BASE } from "../utils/constants";

export default function SingleSlotForm({
  onAdd,
  selectedDate,
  setSelectedDate,
  hour,
  setHour,
  minute,
  setMinute,
  ampm,
  setAmpm,
  timezone,
  setTimezone,
  masterTimes,
  userChangedDate,
  setUserChangedDate,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const label = `${hour}:${minute} ${ampm}`;
    const match = masterTimes.find((t) => t.label === label);

    if (!match) {
      setError("Invalid time selection");
      setLoading(false);
      return;
    }

    console.log("📤 Submitting slot:", {
      day: DateTime.fromJSDate(selectedDate)
        .setZone("America/New_York")
        .toFormat("yyyy-MM-dd"),
      master_time_id: match.id,
      timezone,
    });

    const token = localStorage.getItem("access_token");
    if (!token) {
      showToast("❌ Session expired. Redirecting to login...", "error");

      // Notify other tabs
      import("../utils/tokenChannel").then(
        ({ tokenChannel, MESSAGE_TYPES }) => {
          tokenChannel.postMessage({ type: MESSAGE_TYPES.SESSION_EXPIRED });
        }
      );

      setTimeout(() => {
        window.location.href = "/auth"; // hard redirect for safety
      }, 2000);
      return;
    }

    axios
      .post(
        `${API_BASE}/slots`,
        {
          day: DateTime.fromJSDate(selectedDate)
            .setZone("America/New_York")
            .toFormat("yyyy-MM-dd"),
          master_time_id: match.id,
          timezone,
        },
      )
      .then(() => {
        showToast("Time slot added!");
        if (!userChangedDate) {
          setSelectedDate(new Date());
        }
        if (onAdd) onAdd();
      })
      .catch((err) => {
        console.error(
          "❌ Slot creation failed",
          err.response?.data || err.message
        );
        const msg = err.response?.data?.error || "Failed to add slot";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-md font-bold text-center mb-1">
        Add a New Time Slot
      </h3>

      <div className="space-y-2">
        <label className="label text-xs text-gray-400">Date</label>
        <IconDatePicker
          selected={selectedDate}
          onChange={(date) => {
            setSelectedDate(date);
            setUserChangedDate(true);
          }}
        />
      </div>

      <label className="label text-xs text-gray-400">
        Time (Hour, Min, AM/PM)
      </label>
      <div className="flex gap-2">
        <select
          className="select select-bordered w-1/3"
          value={hour}
          onChange={(e) => setHour(e.target.value)}
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1}>{String(i + 1).padStart(2, "0")}</option>
          ))}
        </select>

        <select
          className="select select-bordered w-1/3"
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
        >
          {["00", "15", "30", "45"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>

        <select
          className="select select-bordered w-1/3 min-w-[4rem]"
          value={ampm}
          onChange={(e) => setAmpm(e.target.value)}
        >
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>

      <label className="label text-xs text-gray-400">Time Zone</label>
      <select
        className="select select-bordered w-full"
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
      >
        <option value="America/New_York">Eastern (EST)</option>
        <option value="America/Chicago">Central (CST)</option>
        <option value="America/Denver">Mountain (MST)</option>
        <option value="America/Los_Angeles">Pacific (PST)</option>
      </select>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Slot"}
      </button>
    </form>
  );
}
