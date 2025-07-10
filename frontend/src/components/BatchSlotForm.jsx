import { useState, useEffect } from "react";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import IconDatePicker from "./IconDatePicker";
import { DateTime } from "luxon";
import "react-datepicker/dist/react-datepicker.css";
import { API_BASE } from "../utils/constants";
import GeneralModal from "./GeneralModal";

export default function BatchSlotForm({
  onBatchAdd,
  selectedDate,
  setSelectedDate,
}) {
  const [startHour, setStartHour] = useState(
    () => localStorage.getItem("slot_hour") || "12"
  );
  const [startMinute, setStartMinute] = useState(
    () => localStorage.getItem("slot_minute") || "00"
  );
  const [startAMPM, setStartAMPM] = useState(
    () => localStorage.getItem("slot_ampm") || "AM"
  );

  const [endHour, setEndHour] = useState(() => {
    const h = parseInt(localStorage.getItem("slot_hour") || "12", 10);
    const newH = h === 12 ? 1 : h + 1;
    return String(newH).padStart(2, "0");
  });
  const [endMinute, setEndMinute] = useState("00");
  const [endAMPM, setEndAMPM] = useState(() => {
    const lastAMPM = localStorage.getItem("slot_ampm") || "AM";
    const h = parseInt(localStorage.getItem("slot_hour") || "12", 10);
    if (h === 11 || h === 12) {
      return lastAMPM === "AM" ? "PM" : "AM";
    }
    return lastAMPM;
  });

  const [interval, setInterval] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const handleBatchSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!interval) {
      setError("❌ Please select a valid interval.");
      return;
    }

    const startTime = `${startHour}:${startMinute} ${startAMPM}`;
    const endTime = `${endHour}:${endMinute} ${endAMPM}`;

    const start = DateTime.fromFormat(startTime, "hh:mm a");
    const end = DateTime.fromFormat(endTime, "hh:mm a");

    const crossesMidnight = end <= start;

    const baseDay = DateTime.fromObject(
      {
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        day: selectedDate.getDate(),
      },
      { zone: "America/New_York" }
    );

    const payload = {
      start_day: baseDay.toFormat("yyyy-MM-dd"),
      end_day: crossesMidnight
        ? baseDay.plus({ days: 1 }).toFormat("yyyy-MM-dd")
        : baseDay.toFormat("yyyy-MM-dd"),
      start_time: startTime,
      end_time: endTime,
      interval: Number(interval),
    };

    if (crossesMidnight) {
      setPendingPayload(payload);
      setShowConfirmModal(true);
    } else {
      sendBatchSlots(payload);
    }
  };

  const sendBatchSlots = async (payload) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        showToast("❌ Session expired. Redirecting to login...", "error");
        import("../utils/tokenChannel").then(
          ({ tokenChannel, MESSAGE_TYPES }) => {
            tokenChannel.postMessage({ type: MESSAGE_TYPES.SESSION_EXPIRED });
          }
        );
        setTimeout(() => (window.location.href = "/auth"), 2000);
        return;
      }

      const res = await axios.post(
        `${API_BASE}/freelancer/batch-slots`,
        payload
      );
      const count = res.data.slots.length;
      showToast(
        `✅ ${count} slot${count !== 1 ? "s" : ""} added`,
        "success",
        5000
      );
      if (onBatchAdd) onBatchAdd();
    } catch (err) {
      const msg = err.response?.data?.error || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
      setPendingPayload(null);
    }
  };

  return (
    <>
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
              onChange={(e) => {
                setStartHour(e.target.value);
                localStorage.setItem("slot_hour", e.target.value);
              }}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1}>{String(i + 1).padStart(2, "0")}</option>
              ))}
            </select>

            <select
              className="select select-bordered w-1/3"
              value={startMinute}
              onChange={(e) => {
                setStartMinute(e.target.value);
                localStorage.setItem("slot_minute", e.target.value);
              }}
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
          <label className="label text-xs text-gray-400 mb-1">
            End Time (Exclusive)
          </label>
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
            onChange={(e) => setInterval(Number(e.target.value))}
          >
            <option value="15">Every 15 minutes</option>
            <option value="30">Every 30 minutes</option>
            <option value="45">Every 45 minutes</option>
            <option value="60">Every 1 hour</option>
          </select>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Generating..." : "Generate Slots"}
        </button>
      </form>
      {showConfirmModal && (
        <GeneralModal
          title="⚠️ Time Range Crosses Into Next Day"
          body={`Are you sure you want to generate time slots:\n\nFrom:\n${
            pendingPayload?.start_time
          } (${DateTime.fromISO(pendingPayload?.start_day).toFormat(
            "M/d/yyyy"
          )})\n\nTo:\n${pendingPayload?.end_time} (${DateTime.fromISO(
            pendingPayload?.end_day
          ).toFormat("M/d/yyyy")})`}
          confirmText="Yes, Continue"
          onClose={() => {
            setShowConfirmModal(false);
            setPendingPayload(null);
          }}
          onConfirm={() => {
            setShowConfirmModal(false);
            if (pendingPayload) sendBatchSlots(pendingPayload);
          }}
        />
      )}
    </>
  );
}
