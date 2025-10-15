import { useState, useEffect } from "react";
import axios from "../../utils/axiosInstance";
import "react-datepicker/dist/react-datepicker.css";
import BatchSlotForm from "./BatchSlotForm";
import SingleSlotForm from "./SingleSlotForm";
import { API_BASE } from "../../utils/constants";
import { useFreelancer } from "../../context/FreelancerContext";

export default function AddSlotForm({
  onAdd,
  syncWith,
  setSyncDate,
  mode,
  setMode,
}) {
  const [selectedDate, setSelectedDate] = useState(syncWith || new Date());

  // Sync DOWN from admin page
  useEffect(() => {
    if (syncWith && syncWith.toDateString() !== selectedDate.toDateString()) {
      setSelectedDate(syncWith);
    }
  }, [syncWith]);

  // Sync UP to admin page when user selects a date
  useEffect(() => {
    if (
      setSyncDate &&
      selectedDate.toDateString() !== syncWith?.toDateString()
    ) {
      setSyncDate(selectedDate);
    }
  }, [selectedDate]);
  const [hour, setHour] = useState(
    () => localStorage.getItem("slot_hour") || "12"
  );
  const [minute, setMinute] = useState(
    () => localStorage.getItem("slot_minute") || "00"
  );
  const [ampm, setAmpm] = useState(
    () => localStorage.getItem("slot_ampm") || "AM"
  );

  const { freelancer } = useFreelancer();
  const timezone = freelancer?.timezone || "America/New_York";
  const [masterTimes, setMasterTimes] = useState([]);
  const [timesLoading, setTimesLoading] = useState(true);
  const [userChangedDate, setUserChangedDate] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    axios
      .get(`${API_BASE}/master-times`)
      .then((res) => setMasterTimes(res.data))
      .catch((err) => {
        console.error("❌ Failed to fetch master times", err);
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
          setHour={(h) => {
            setHour(h);
            localStorage.setItem("slot_hour", h);
          }}
          minute={minute}
          setMinute={(m) => {
            setMinute(m);
            localStorage.setItem("slot_minute", m);
          }}
          ampm={ampm}
          setAmpm={(a) => {
            setAmpm(a);
            localStorage.setItem("slot_ampm", a);
          }}
          timezone={timezone}
          masterTimes={masterTimes}
          userChangedDate={userChangedDate}
          setUserChangedDate={setUserChangedDate}
        />
      )}

      {mode === "batch" && (
        <BatchSlotForm
          onBatchAdd={onAdd}
          selectedDate={selectedDate}
          setSelectedDate={(newDate) => {
            setSelectedDate(newDate);
            if (setSyncDate) setSyncDate(newDate);
          }}
          freelancerTimezone={timezone} // ✅ pass down the freelancer's timezone
        />
      )}
    </div>
  );
}
