// AddSlotForm.jsx
// This is a React component that lets freelancers add new time slots by selecting day, hour, minute, and AM/PM.

import { useState, useEffect } from "react";
import axios from "axios";
import { showToast } from "../utils/toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function AddSlotForm({ onAdd }) {
  const [selectedDate, setSelectedDate] = useState(new Date()); // ✅ renamed from `day`
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState("AM");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [masterTimes, setMasterTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timesLoading, setTimesLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/master-times", {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
        },
      })
      .then((res) => {
        setMasterTimes(res.data);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch master times", err);
        setError("Invalid time selection (auth error)");
      })
      .finally(() => setTimesLoading(false));
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (masterTimes.length > 0) {
      const label = `${hour}:${minute} ${ampm}`;
      const exists = masterTimes.some((t) => t.label === label);
      if (!exists) {
        const fallback = masterTimes[0].label;
        const [timePart, meridiem] = fallback.split(" ");
        const [h, m] = timePart.split(":");
        setHour(h.padStart(2, "0"));
        setMinute(m.padStart(2, "0"));
        setAmpm(meridiem);
      }
    }
  }, [masterTimes]);

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

    axios
      .post(
        "http://127.0.0.1:5000/slots",
        {
          day: selectedDate.toISOString().split("T")[0],
          master_time_id: match.id,
          timezone,
        },
        {
          headers: {
            "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
          },
        }
      )
      .then(() => {
        showToast("Time slot added!");
        setSelectedDate(new Date());
        setHour("12");
        setMinute("00");
        setAmpm("AM");
        if (onAdd) onAdd();
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Failed to add slot";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  if (timesLoading) {
    return (
      <p className="text-center text-sm">Loading available time options...</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-md font-bold text-center">Add a New Time Slot</h3>

      <div className="relative w-full">
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          className="input input-bordered w-full pl-10"
          wrapperClassName="w-full"
          dateFormat="MMMM d, yyyy"
          placeholderText="Choose a date"
        />
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
          📅
        </span>
      </div>

      <div className="flex gap-2">
        <select
          className="select select-bordered"
          value={hour}
          onChange={(e) => setHour(e.target.value)}
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1}>{String(i + 1).padStart(2, "0")}</option>
          ))}
        </select>

        <select
          className="select select-bordered"
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
        >
          {["00", "15", "30", "45"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>

        <select
          className="select select-bordered"
          value={ampm}
          onChange={(e) => setAmpm(e.target.value)}
        >
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

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

      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Adding..." : "Add Slot"}
      </button>
    </form>
  );
}