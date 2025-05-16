import { useState } from "react";

const fakeSlots = [
  "10:00 AM",
  "11:30 AM",
  "1:00 PM",
  "2:30 PM",
  "4:00 PM",
];

export default function BookingPage() {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Booking submitted:", { selectedSlot, name, email });
    setSuccess(true);
    setName("");
    setEmail("");
    setSelectedSlot(null);
    setTimeout(() => setSuccess(false), 4000); // Hide message after 4 seconds
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-center">Book a Time Slot</h2>

      {success && (
        <div className="alert alert-success shadow-lg">
          <span>Booking confirmed! We'll email you shortly.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {fakeSlots.map((slot) => (
          <button
            key={slot}
            className={`btn ${
              selectedSlot === slot ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => setSelectedSlot(slot)}
            type="button"
          >
            {slot}
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

        <button className="btn btn-primary w-full" disabled={!selectedSlot}>
          Book Appointment
        </button>
      </form>
    </div>
  );
}