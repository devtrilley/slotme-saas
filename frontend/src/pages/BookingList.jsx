import { useEffect, useState } from "react";
import axios from "axios";

export default function BookingList() {
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newSlotId, setNewSlotId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState("info");

  useEffect(() => {
    fetchData();
  }, []);

  const getDateFromTimeStr = (timeStr) => {
    const [hourMinute, ampm] = timeStr.split(" ");
    let [hour, minute] = hourMinute.split(":").map(Number);
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const fetchData = () => {
    axios
      .get("http://127.0.0.1:5000/appointments")
      .then((res) => {
        const sorted = [...res.data].sort(
          (a, b) => getDateFromTimeStr(a.slot_time) - getDateFromTimeStr(b.slot_time)
        );
        setAppointments(sorted);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch appointments:", err);
      });

    axios
      .get("http://127.0.0.1:5000/slots")
      .then((res) => {
        setSlots(res.data.filter((s) => !s.is_booked)); // only show unbooked slots
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots:", err);
      });
  };

  const handleDelete = async (id) => {
    setLoadingId(id);
    setMessage(null);

    try {
      await axios.delete(`http://127.0.0.1:5000/appointments/${id}`);
      setAppointments((prev) => prev.filter((app) => app.id !== id));
      setMessage("✅ Appointment cancelled.");
      setMessageType("success");
    } catch (err) {
      console.error("❌ Failed to delete booking", err);
      setMessage("❌ Failed to cancel appointment.");
      setMessageType("error");
    } finally {
      setLoadingId(null);
    }
  };

  const handleReschedule = async (id) => {
    if (!newSlotId) return;

    setLoadingId(id);
    setMessage(null);

    try {
      await axios.patch(`http://127.0.0.1:5000/appointments/${id}`, {
        slot_id: newSlotId,
      });

      setSelectedId(null);
      setNewSlotId(null);
      fetchData(); // refresh both lists
      setMessage("✅ Appointment rescheduled.");
      setMessageType("success");
    } catch (err) {
      console.error("❌ Failed to reschedule", err);
      setMessage("❌ Failed to reschedule. Slot may be booked.");
      setMessageType("error");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">All Bookings</h2>

      {message && (
        <div
          className={`alert ${
            messageType === "success" ? "alert-success" : "alert-error"
          } shadow-sm`}
        >
          <span>{message}</span>
        </div>
      )}

      {appointments.length === 0 ? (
        <p className="text-center">No bookings yet.</p>
      ) : (
        appointments.map((app) => (
          <div
            key={app.id}
            className="p-4 border rounded-lg shadow-md bg-base-200 space-y-2"
          >
            <p>
              <strong>Name:</strong> {app.name}
            </p>
            <p>
              <strong>Email:</strong> {app.email}
            </p>
            <p>
              <strong>Time Slot:</strong> {app.slot_time}
            </p>

            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-error"
                onClick={() => handleDelete(app.id)}
                disabled={loadingId === app.id}
              >
                {loadingId === app.id ? "Cancelling..." : "Cancel"}
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() =>
                  setSelectedId((prev) => (prev === app.id ? null : app.id))
                }
              >
                Reschedule
              </button>
            </div>

            {selectedId === app.id && (
              <div className="space-y-2 pt-2">
                <select
                  className="select select-bordered w-full"
                  value={newSlotId || ""}
                  onChange={(e) => setNewSlotId(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Select new time
                  </option>
                  {slots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.time}
                    </option>
                  ))}
                </select>

                <button
                  className="btn btn-sm btn-primary w-full"
                  disabled={!newSlotId || loadingId === app.id}
                  onClick={() => handleReschedule(app.id)}
                >
                  {loadingId === app.id
                    ? "Rescheduling..."
                    : "Confirm Reschedule"}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}