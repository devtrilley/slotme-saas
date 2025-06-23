import { useState, useEffect } from "react";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import BatchSlotForm from "./BatchSlotForm";
import SingleSlotForm from "./SingleSlotForm";
import { API_BASE } from "../utils/constants";

export default function AddSlotForm({ onAdd }) {
  const [mode, setMode] = useState("single");
  const [selectedDate, setSelectedDate] = useState(new Date());
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
  const [userChangedDate, setUserChangedDate] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/master-times`, {})
      .then((res) => setMasterTimes(res.data))
      .catch((err) => {
        console.error("❌ Failed to fetch master times", err);
        setError("Invalid time selection (auth error)");
      })
      .finally(() => setTimesLoading(false));
  }, []);

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
        `${API_BASE}/slots`,
        {
          day: selectedDate.toISOString().split("T")[0],
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
        const msg = err.response?.data?.error || "Failed to add slot";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  if (timesLoading)
    return (
      <p className="text-center text-sm">Loading available time options...</p>
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 mb-2">
        <button
          type="button"
          className={`btn btn-sm ${
            mode === "single" ? "btn-primary" : "btn-outline"
          }`}
          onClick={() => setMode("single")}
        >
          Single Slot
        </button>
        <button
          type="button"
          className={`btn btn-sm ${
            mode === "batch" ? "btn-primary" : "btn-outline"
          }`}
          onClick={() => setMode("batch")}
        >
          Batch Slots
        </button>
      </div>

      {mode === "single" && (
        <SingleSlotForm
          onAdd={onAdd}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          hour={hour}
          setHour={setHour}
          minute={minute}
          setMinute={setMinute}
          ampm={ampm}
          setAmpm={setAmpm}
          timezone={timezone}
          setTimezone={setTimezone}
          masterTimes={masterTimes}
          userChangedDate={userChangedDate}
          setUserChangedDate={setUserChangedDate}
        />
      )}

      {mode === "batch" && <BatchSlotForm onBatchAdd={onAdd} />}
    </div>
  );
}
