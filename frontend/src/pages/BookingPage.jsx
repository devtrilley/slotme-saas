import { useEffect, useState } from "react";
import axios from "axios";

export default function BookingPage() {
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Fetch available slots from backend on load
  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/slots")
      .then((res) => setSlots(res.data))
      .catch((err) => console.error("Failed to fetch slots", err));
  }, []);

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
    } catch (err) {
      const msg = err.response?.data?.error || "Booking failed";
      setError(msg);
      console.error("❌", msg);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-center">Book a Time Slot</h2>

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

      <div className="grid grid-cols-2 gap-4">
        {slots.map((slot) => (
          <button
            key={slot.id}
            className={`btn ${
              selectedSlotId === slot.id ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => setSelectedSlotId(slot.id)}
            disabled={slot.is_booked}
            type="button"
          >
            {slot.time}
          </button>
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

        <button className="btn btn-primary w-full" disabled={!selectedSlotId}>
          Book Appointment
        </button>
      </form>
    </div>
  );
}
