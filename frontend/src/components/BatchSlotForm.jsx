import { useState, useEffect } from "react";
import axios from "axios";
import { showToast } from "../utils/toast";
import IconDatePicker from "./IconDatePicker";
import "react-datepicker/dist/react-datepicker.css";

export default function BatchSlotForm({ onBatchAdd }) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [startHour, setStartHour] = useState("12");
  const [startMinute, setStartMinute] = useState("00");
  const [startAMPM, setStartAMPM] = useState("PM");

  const [endHour, setEndHour] = useState("07");
  const [endMinute, setEndMinute] = useState("00");
  const [endAMPM, setEndAMPM] = useState("PM");

  const [interval, setInterval] = useState("15");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const startTime = `${startHour}:${startMinute} ${startAMPM}`;
    const endTime = `${endHour}:${endMinute} ${endAMPM}`;

    try {
      const payload = {
        day: selectedDate.toISOString().split("T")[0],
        start_time: startTime,
        end_time: endTime,
        interval: interval,
      };

      await axios.post(
        "http://127.0.0.1:5000/freelancer/batch-slots",
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      showToast("✅ Slots generated!");
      if (onBatchAdd) onBatchAdd();
    } catch (err) {
      const msg = err.response?.data?.error || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleBatchSubmit} className="space-y-4">
      <h3 className="text-md font-bold text-center">
        Generate Time Slots in Bulk
      </h3>

      <div>
        <label className="label text-xs text-gray-400 mb-1">Date</label>
        <IconDatePicker selected={selectedDate} onChange={setSelectedDate} />
      </div>

      <div>
        <label className="label text-xs text-gray-400 mb-1">
          Start Time (Inclusive)
        </label>
        <div className="flex gap-2">
          <select
            className="select select-bordered w-1/3"
            value={startHour}
            onChange={(e) => setStartHour(e.target.value)}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1}>{String(i + 1).padStart(2, "0")}</option>
            ))}
          </select>

          <select
            className="select select-bordered w-1/3"
            value={startMinute}
            onChange={(e) => setStartMinute(e.target.value)}
          >
            {["00", "15", "30", "45"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          <select
            className="select select-bordered w-1/3 min-w-[4rem]"
            value={startAMPM}
            onChange={(e) => setStartAMPM(e.target.value)}
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label text-xs text-gray-400 mb-1">End Time (Exclusive)</label>
        <div className="flex gap-2">
          <select
            className="select select-bordered w-1/3"
            value={endHour}
            onChange={(e) => setEndHour(e.target.value)}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1}>{String(i + 1).padStart(2, "0")}</option>
            ))}
          </select>

          <select
            className="select select-bordered w-1/3"
            value={endMinute}
            onChange={(e) => setEndMinute(e.target.value)}
          >
            {["00", "15", "30", "45"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          <select
            className="select select-bordered w-1/3 min-w-[4rem]"
            value={endAMPM}
            onChange={(e) => setEndAMPM(e.target.value)}
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label text-xs text-gray-400 mb-1">Interval</label>
        <select
          className="select select-bordered w-full"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
        >
          <option value="15">Every 15 minutes</option>
          <option value="30">Every 30 minutes</option>
        </select>
      </div>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Generating..." : "Generate Slots"}
      </button>
    </form>
  );
}