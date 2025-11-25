import { useState } from "react";
import axios from "../../utils/axiosInstance";
import { showToast } from "../../utils/toast";
import "react-datepicker/dist/react-datepicker.css";
import IconDatePicker from "../Inputs/IconDatePicker";
import { DateTime } from "luxon";
import { API_BASE } from "../../utils/constants";

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

    if (!masterTimes || masterTimes.length === 0) {
      showToast("Can't create slot. Refresh page.", "error");
      setLoading(false);
      return;
    }

    if (!selectedDate || isNaN(selectedDate.getTime())) {
      showToast("Pick a valid date.", "warning");
      setLoading(false);
      return;
    }

    if (!timezone) {
      showToast("Timezone missing. Refresh page.", "error");
      setLoading(false);
      return;
    }

    // Convert 12-hour format (hour + AM/PM) to 24-hour format
    let hour24 = parseInt(hour);
    if (ampm === "PM" && hour24 < 12) hour24 += 12;
    if (ampm === "AM" && hour24 === 12) hour24 = 0;

    const localDateTime = DateTime.fromObject(
      {
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        day: selectedDate.getDate(),
        hour: hour24,
        minute: parseInt(minute),
      },
      { zone: timezone }
    );

    const utcDateTime = localDateTime.toUTC();
    const utcHour = utcDateTime.toFormat("HH");
    const utcMinute = utcDateTime.toFormat("mm");
    const utcDateStr = utcDateTime.toFormat("yyyy-MM-dd");

    const label = `${utcHour}:${utcMinute}`;
    const match = masterTimes.find((t) => t.time_24h.startsWith(label));

    if (!match) {
      showToast("Time conversion failed. Try another time.", "error");
      setLoading(false);
      return;
    }

    

    axios
      .post(`${API_BASE}/slots`, {
        day: utcDateStr,
        master_time_id: match.id,
        timezone,
      })
      .then(() => {
        showToast("Time slot added!");

        if (onAdd) onAdd();
      })
      .catch((err) => {
        console.error(
          "❌ Slot creation failed",
          err.response?.data || err.message
        );
        const msg =
          err.response?.data?.error ||
          "Slot creation failed. May conflict with existing slot.";
        showToast(msg, "error");
        setError(""); // Optional: hide static error now that toast handles it
      })
      .finally(() => setLoading(false));

    const token = localStorage.getItem("access_token");
    if (!token) {
      showToast("❌ Session expired. Redirecting to login...", "error");

      // Notify other tabs
      import("../../utils/tokenChannel").then(
        ({ tokenChannel, MESSAGE_TYPES }) => {
          tokenChannel.postMessage({ type: MESSAGE_TYPES.SESSION_EXPIRED });
        }
      );

      setTimeout(() => {
        window.location.href = "/auth"; // hard redirect for safety
      }, 2000);
      return;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-md font-bold text-center mb-1">
        Add a New Time Slot
      </h3>

      <p className="text-sm text-center text-gray-400 mt-1">
        ⏰ Slot will be created in your selected timezone:{" "}
        <span className="font-semibold">
          {DateTime.now().setZone(timezone).offsetNameShort}
        </span>
      </p>

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

      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Slot"}
      </button>
    </form>
  );
}
