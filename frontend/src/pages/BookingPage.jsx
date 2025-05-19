import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function BookingPage() {
  const { clientId } = useParams(); // 🔑 from /book/:clientId
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState({
    name: "",
    logo_url: "",
    tagline: "",
    bio: "",
  });

  useEffect(() => {
    fetchSlots();

    axios
      .get("http://127.0.0.1:5000/client-info", {
        headers: { "X-Client-ID": clientId },
      })
      .then((res) => {
        setBranding({
          name: res.data.name || "",
          logo_url: res.data.logo_url || "",
          tagline: res.data.tagline || "",
          bio: res.data.bio || "",
        });
      })
      .catch((err) => {
        console.error("❌ Failed to load branding", err);
      });
  }, [clientId]);

  const fetchSlots = () => {
    setLoading(true);
    axios
      .get("http://127.0.0.1:5000/slots", {
        headers: { "X-Client-ID": clientId },
      })
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => {
          const toDate = (timeStr) => {
            const [h, m] = timeStr.split(/[: ]/);
            let hour = parseInt(h),
              minute = parseInt(m);
            const isPM = timeStr.includes("PM");
            if (isPM && hour !== 12) hour += 12;
            if (!isPM && hour === 12) hour = 0;
            const date = new Date();
            date.setHours(hour, minute, 0, 0);
            return date;
          };
          return toDate(a.time) - toDate(b.time);
        });
        setSlots(sorted);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots", err);
        setError("Booking page unavailable.");
      })
      .finally(() => setLoading(false));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedSlotId) return;

    axios
      .post(
        "http://127.0.0.1:5000/book",
        {
          name,
          email,
          slot_id: selectedSlotId,
        },
        {
          headers: { "X-Client-ID": clientId },
        }
      )
      .then(() => {
        setSuccess(true);
        setName("");
        setEmail("");
        setSelectedSlotId(null);
        setTimeout(() => setSuccess(false), 4000);
        fetchSlots(); // Refresh
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Booking failed";
        setError(msg);
        console.error("❌", msg);
      });
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 p-4 border rounded shadow bg-base-200">
        <img
          src={
            branding.logo_url?.trim()
              ? branding.logo_url
              : "https://placehold.co/64x64?text=Logo"
          }
          alt="Logo"
          className="w-16 h-16 rounded-full object-cover"
        />
        <div>
          <p className="font-bold text-lg">{branding.name}</p>
          {branding.tagline && (
            <p className="text-sm text-gray-400">{branding.tagline}</p>
          )}
          {branding.bio && (
            <p className="text-xs text-gray-500">{branding.bio}</p>
          )}
        </div>
      </div>
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

      {loading ? (
        <p className="text-center">Loading slots...</p>
      ) : (
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
                  !slot.is_booked &&
                  setSelectedSlotId((prev) =>
                    prev === slot.id ? null : slot.id
                  )
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
      )}

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
          className={`btn w-full btn-primary ${
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
