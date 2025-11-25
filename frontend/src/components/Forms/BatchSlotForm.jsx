import { useState, useEffect } from "react";
import axios from "../../utils/axiosInstance";
import { showToast } from "../../utils/toast";
import IconDatePicker from "../Inputs/IconDatePicker";
import { DateTime } from "luxon";
import "react-datepicker/dist/react-datepicker.css";
import { API_BASE } from "../../utils/constants";
import CrossDayConfirmModal from "../Modals/CrossDayConfirmModal";

const formatTimeForAPI = (hour, minute, ampm) => {
  const paddedHour = hour.padStart(2, "0");
  return `${paddedHour}:${minute} ${ampm}`;
};

const getLocalDateString = (date, freelancerTimezone) => {
  return DateTime.fromJSDate(date)
    .setZone(freelancerTimezone)
    .toFormat("yyyy-MM-dd");
};

export default function BatchSlotForm({
  onBatchAdd,
  selectedDate,
  setSelectedDate,
  freelancerTimezone, // ✅ add this prop
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
    return (
      localStorage.getItem("slot_end_hour") ||
      (() => {
        const h = parseInt(localStorage.getItem("slot_hour") || "12", 10);
        const newH = h === 12 ? 1 : h + 1;
        return String(newH).padStart(2, "0");
      })()
    );
  });

  const [endMinute, setEndMinute] = useState(() => {
    return localStorage.getItem("slot_end_minute") || "00";
  });

  const [endAMPM, setEndAMPM] = useState(() => {
    return (
      localStorage.getItem("slot_end_ampm") ||
      (() => {
        const lastAMPM = localStorage.getItem("slot_ampm") || "AM";
        const h = parseInt(localStorage.getItem("slot_hour") || "12", 10);
        if (h === 11 || h === 12) {
          return lastAMPM === "AM" ? "PM" : "AM";
        }
        return lastAMPM;
      })()
    );
  });

  const [interval, setInterval] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const [lastCreatedSlots, setLastCreatedSlots] = useState([]);

  // Get freelancer timezone (you'll need to pass this as a prop or get from context)
  // ✅ use the prop directly (already destructured above)
  const timezoneToUse = freelancerTimezone || "America/New_York";
  const handleBatchSubmit = (e) => {
    e.preventDefault();

    if (!interval) {
      setError("⚠ Please select a valid interval.");
      return;
    }

    // Get local times as entered by user
    const localStartTime = formatTimeForAPI(startHour, startMinute, startAMPM);
    const localEndTime = formatTimeForAPI(endHour, endMinute, endAMPM);

    

    // Validate the LOCAL times for user experience
    const start = DateTime.fromFormat(localStartTime, "hh:mm a");
    const end = DateTime.fromFormat(localEndTime, "hh:mm a");
    const crossesMidnight = end <= start;

    if (end <= start && !showConfirmModal) {
      const startHourNum = parseInt(startHour);
      const endHourNum = parseInt(endHour);
      const sameAMPM = startAMPM === endAMPM;

      const isSameDayButInvalid =
        sameAMPM &&
        (endHourNum < startHourNum ||
          (endHourNum === startHourNum && endMinute < startMinute));

      if (isSameDayButInvalid) {
        showToast("⚠ End time must be after start time.", "error");
        return;
      }
    }

    // 🔥 FIX: Get local date string (no UTC conversion needed)
    const localDateString = getLocalDateString(
      selectedDate,
      freelancerTimezone
    );

    const payload = {
      start_day: localDateString, // 🔥 Send LOCAL date
      end_day: localDateString, // 🔥 Send LOCAL date (backend will handle day shift)
      start_time: localStartTime, // 🔥 Send LOCAL time
      end_time: localEndTime, // 🔥 Send LOCAL time
      interval: Number(interval),
      freelancer_timezone: freelancerTimezone,
    };

    

    if (crossesMidnight) {
      const nextDayString = DateTime.fromJSDate(selectedDate)
        .setZone(freelancerTimezone)
        .plus({ days: 1 })
        .toFormat("yyyy-MM-dd");

      setPendingPayload({
        slotStart: {
          time: localStartTime,
          time_12h: localStartTime,
          day: localDateString,
        },
        slotEnd: {
          time: localEndTime,
          time_12h: localEndTime,
          day: nextDayString,
        },
        interval: Number(interval),
        backendPayload: {
          start_day: localDateString,
          end_day: nextDayString, // Only advance day for cross-midnight
          start_time: localStartTime,
          end_time: localEndTime,
          interval: Number(interval),
          freelancer_timezone: freelancerTimezone,
        },
      });
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
        showToast("Session expired. Logging out...", "warning");
        import("../../utils/tokenChannel").then(
          ({ tokenChannel, MESSAGE_TYPES }) => {
            tokenChannel.postMessage({ type: MESSAGE_TYPES.SESSION_EXPIRED });
          }
        );
        setTimeout(() => (window.location.href = "/auth"), 2000);
        return;
      }

      

      const res = await axios.post(
        `${API_BASE}/freelancer/batch-slots-v2`,
        payload
      );
      const count = res.data.slots_created?.length || 0;
      const createdSlotIds = res.data.slots_created?.map((s) => s.id) || []; // 🔥 NEW: Get IDs

      setLastCreatedSlots(createdSlotIds); // 🔥 NEW: Store for undo

      showToast(
        `✅ ${count} slot${count !== 1 ? "s" : ""} added`,
        "success",
        10000 // 🔥 CHANGED: 10 seconds instead of 5
      );

      if (onBatchAdd) onBatchAdd();
    } catch (err) {
      console.error("❌ Batch slot creation failed:", err);

      // 🔥 FIX: Detect auth errors and redirect immediately
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error || "";

      if (
        status === 401 ||
        status === 403 ||
        errorMsg.includes("auth") ||
        errorMsg.includes("token") ||
        errorMsg.includes("expired") ||
        errorMsg.includes("internal_auth_error")
      ) {
        // Clear invalid token
        localStorage.removeItem("access_token");
        localStorage.removeItem("freelancer");

        // Redirect immediately
        window.location.href = "/auth";
        return;
      }

      // Regular error handling
      const msg =
  err.response?.data?.error || "Couldn't create slots. Try again.";
showToast(msg, "error");
      setError("");
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
      setPendingPayload(null);
    }
  };

  const handleUndo = async () => {
    if (lastCreatedSlots.length === 0) return;

    try {
      // Delete all the slots that were just created
      await Promise.all(
        lastCreatedSlots.map((slotId) =>
          axios.delete(`${API_BASE}/slots/${slotId}`)
        )
      );

      showToast(`🔄 Undid ${lastCreatedSlots.length} slots`, "success");
      setLastCreatedSlots([]);
      if (onBatchAdd) onBatchAdd(); // Refresh the list
    } catch (err) {
      console.error("Failed to undo:", err);
      showToast("Couldn't undo. Slots may be booked.", "error");
    }
  };

  return (
    <>
      <form onSubmit={handleBatchSubmit} className="space-y-4">
        <h3 className="text-md font-bold text-center">
          Generate Time Slots in Bulk
        </h3>

        <p className="text-sm text-center text-gray-400 mt-1">
          ⏰ Slots will be created in your selected timezone:{" "}
          <span className="font-semibold">
            {DateTime.now().setZone(freelancerTimezone).offsetNameShort}
          </span>
        </p>

        <div>
          <label className="label text-xs text-gray-400 mb-1">Date</label>
          <IconDatePicker selected={selectedDate} onChange={setSelectedDate} />
        </div>

        <div>
          <label className="label text-xs text-gray-400 mb-1">
            Start Time (Inclusive) - Your Local Time
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
              onChange={(e) => {
                setStartAMPM(e.target.value);
                localStorage.setItem("slot_ampm", e.target.value); // 🔥 FIX: Save to localStorage
              }}
            >
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label text-xs text-gray-400 mb-1">
            End Time (Exclusive) - Your Local Time
          </label>
          <div className="flex gap-2">
            <select
              className="select select-bordered w-1/3"
              value={endHour}
              onChange={(e) => {
                setEndHour(e.target.value);
                localStorage.setItem("slot_end_hour", e.target.value);
              }}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1}>{String(i + 1).padStart(2, "0")}</option>
              ))}
            </select>

            <select
              className="select select-bordered w-1/3"
              value={endMinute}
              onChange={(e) => {
                setEndMinute(e.target.value);
                localStorage.setItem("slot_end_minute", e.target.value);
              }}
            >
              {["00", "15", "30", "45"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>

            <select
              className="select select-bordered w-1/3 min-w-[4rem]"
              value={endAMPM}
              onChange={(e) => {
                setEndAMPM(e.target.value);
                localStorage.setItem("slot_end_ampm", e.target.value); // 🔥 FIX: Save to localStorage
              }}
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

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Generating..." : "Generate Slots"}
        </button>

        {lastCreatedSlots.length > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-warning w-full"
            onClick={handleUndo}
          >
            ⏪ Undo Last Batch ({lastCreatedSlots.length} slots)
          </button>
        )}
      </form>
      {showConfirmModal && (
        <CrossDayConfirmModal
          open={showConfirmModal}
          payload={pendingPayload}
          freelancerTimezone={freelancerTimezone} // ✅ Pass it in!
          onClose={() => {
            setShowConfirmModal(false);
            setPendingPayload(null);
          }}
          onConfirm={(finalPayload) => {
            setShowConfirmModal(false);
            if (finalPayload) sendBatchSlots(finalPayload);
          }}
        />
      )}
    </>
  );
}
