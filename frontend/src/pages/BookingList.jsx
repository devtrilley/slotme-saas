import { useEffect, useState } from "react";
import axios from "axios";

export default function BookingList() {
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newSlotId, setNewSlotId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    axios
      .get("http://127.0.0.1:5000/appointments")
      .then((res) => {
        console.log("✅ Appointments fetched:", res.data);
        setAppointments(res.data);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch appointments:", err);
      });

    axios
      .get("http://127.0.0.1:5000/slots")
      .then((res) => {
        setSlots(res.data.filter((s) => !s.is_booked)); // only free slots
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots:", err);
      });
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/appointments/${id}`);
      setAppointments((prev) => prev.filter((app) => app.id !== id));
      console.log("🗑️ Booking deleted:", id);
    } catch (err) {
      console.error("❌ Failed to delete booking", err);
    }
  };

  const handleReschedule = async (id) => {
    if (!newSlotId) return;

    try {
      await axios.put(`http://127.0.0.1:5000/appointments/${id}`, {
        slot_id: newSlotId,
      });

      setSelectedId(null);
      setNewSlotId(null);
      fetchData(); // Refresh
      console.log("🔁 Booking rescheduled:", id);
    } catch (err) {
      console.error("❌ Failed to reschedule", err);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">All Bookings</h2>

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
              >
                Cancel
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
                  disabled={!newSlotId}
                  onClick={() => handleReschedule(app.id)}
                >
                  Confirm Reschedule
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}