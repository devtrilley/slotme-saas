import { useEffect, useState } from "react";
import axios from "axios";

function convertTo24Hr(time) {
  const [t, mod] = time.split(" ");
  let [h, m] = t.split(":").map(Number);
  if (mod === "PM" && h !== 12) h += 12;
  if (mod === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${m}:00`;
}

export default function BookingPage() {
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Fetch available slots from backend on load
  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = () => {
    setLoading(true);
    axios
      .get("http://127.0.0.1:5000/slots?client_id=1")
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => {
          const getDate = (timeStr) => {
            const [hourMinute, ampm] = timeStr.split(" ");
            let [hour, minute] = hourMinute.split(":").map(Number);

            if (ampm === "PM" && hour !== 12) hour += 12;
            if (ampm === "AM" && hour === 12) hour = 0;

            const date = new Date();
            date.setHours(hour, minute, 0, 0);
            return date;
          };

          return getDate(a.time) - getDate(b.time);
        });
        setSlots(sorted);
        setFetchError("");
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots", err);
        setFetchError("Could not load time slots. Try again later.");
      })
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("http://127.0.0.1:5000/book", {
        name,
        email,
        slot_id: selectedSlotId,
      });

      console.log("✅ Booked!", res.data);
      setSuccess(true);
      setName("");
      setEmail("");
      setSelectedSlotId(null);
      setTimeout(() => setSuccess(false), 4000);
      fetchSlots(); // refresh list after booking
    } catch (err) {
      const msg = err.response?.data?.error || "Booking failed";
      if (msg === "Email already has an appointment.") {
        setError(
          "Looks like you've already booked! You can reschedule or cancel from the bookings page."
        );
      } else {
        setError(msg);
      }
      console.error("❌", msg);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-bold text-center">Book a Time Slot</h2>
        <button
          className="btn btn-sm btn-outline"
          onClick={fetchSlots}
          disabled={loading}
        >
          🔁 Refresh
        </button>
      </div>

      {success && (
        <div className="alert alert-success shadow-lg">
          <span>Booking confirmed! We'll email you shortly.</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error shadow-lg">
          <span>{error}</span>
        </div>
      )}

      {loading && <p className="text-center">Loading slots...</p>}
      {fetchError && <p className="text-center text-red-500">{fetchError}</p>}

      <div className="grid grid-cols-2 gap-4">
        {slots.map((slot) => (
          <div key={slot.id} className="flex flex-col items-center">
            <button
              className={`btn ${
                slot.is_booked
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : selectedSlotId === slot.id
                  ? "btn-primary text-white"
                  : "btn-outline text-white border-white"
              }`}
              onClick={() =>
                setSelectedSlotId((prev) => (prev === slot.id ? null : slot.id))
              }
              disabled={slot.is_booked}
              type="button"
            >
              {slot.time}
            </button>

            {slot.is_booked && (
              <span className="text-xs text-red-400 mt-1">Booked</span>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Your name"
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Your email"
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          className={`btn w-full btn-primary text-white ${
            !selectedSlotId ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={!selectedSlotId}
        >
          Book Appointment
        </button>
      </form>
    </div>
  );
}
