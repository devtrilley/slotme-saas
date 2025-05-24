import { useEffect, useState } from "react";
import axios from "axios";
import FreelancerBranding from "../components/FreelancerBranding";
import { showToast } from "../utils/toast";
import AddSlotForm from "../components/AddSlotForm";

function getDateFromTimeStr(timeStr) {
  const [hourMinute, ampm] = timeStr.split(" ");
  let [hour, minute] = hourMinute.split(":").map(Number);
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

export default function AdminPage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Default: YYYY-MM-DD
  });
  const [branding, setBranding] = useState({
    name: "",
    logo_url: "",
    tagline: "",
    bio: "",
  });

  const fetchSlots = () => {
    setLoading(true);
    axios
      .get("http://127.0.0.1:5000/slots", {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
        },
      })
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => {
          const dateA = new Date(`${a.day} ${a.time}`);
          const dateB = new Date(`${b.day} ${b.time}`);
          return dateA - dateB;
        });
        setSlots(sorted);
        setFetchError("");
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots", err);
        setFetchError("Could not load time slots.");
      })
      .finally(() => setLoading(false));
  };

  const fetchBranding = () => {
    axios
      .get("http://127.0.0.1:5000/freelancer-info", {
        headers: { "X-Freelancer-ID": localStorage.getItem("freelancer_id") },
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
  };

  const handleDelete = (slotId) => {
    if (!confirm("Are you sure you want to delete this time slot?")) return;

    axios
      .delete(`http://127.0.0.1:5000/slots/${slotId}`, {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
        },
      })
      .then(() => {
        showToast("Slot deleted");
        fetchSlots();
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Failed to delete slot";
        showToast(msg, "error");
      });
  };

  const [brandingUpdated, setBrandingUpdated] = useState(0);

  useEffect(() => {
    fetchSlots();
    fetchBranding();
  }, [brandingUpdated]);

  const shareUrl = `http://localhost:5173/book/${localStorage.getItem(
    "freelancer_id"
  )}`;

  const filteredSlots = slots.filter((slot) => slot.day === selectedDate);

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2 items-center">
        <h2 className="text-2xl font-bold text-center">
          Freelancer Admin Dashboard
        </h2>
        <button
          onClick={() => {
            localStorage.removeItem("freelancer_logged_in");
            window.location.href = "/";
          }}
          className="btn btn-sm btn-outline"
        >
          Logout
        </button>
      </div>

      <div className="flex items-center gap-4 p-4 border rounded bg-base-100 shadow">
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

      <div className="p-4 bg-base-200 border rounded-lg shadow space-y-2">
        <p className="text-sm font-medium text-center">
          Your Public Booking Link
        </p>
        <p className="text-sm text-primary text-center break-words">
          {shareUrl}
        </p>
        <button
          className="btn btn-xs btn-outline block mx-auto"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            showToast("Link copied to clipboard!");
          }}
        >
          Copy Link
        </button>
      </div>

      <AddSlotForm onAdd={fetchSlots} />

      {loading && <p className="text-center">Loading...</p>}
      {fetchError && <p className="text-red-500 text-center">{fetchError}</p>}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-center border-b pb-1">
          Your Time Slots
        </h3>

        <label className="text-sm text-gray-400 block text-center">
          Select a date to view / edit your time slots:
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value); // ✅ Use the raw value directly
          }}
          className="input input-bordered w-full"
        />

        {filteredSlots.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            No slots for this day.
          </p>
        ) : (
          filteredSlots.map((slot) => (
            <div
              key={slot.id}
              className="p-4 border rounded-lg bg-base-100 shadow-sm"
            >
              <p className="text-xs text-gray-400 mb-1">
                {formatDate(slot.day)}
              </p>
              <p className="text-lg font-semibold">{slot.time}</p>
              {slot.is_booked ? (
                slot.appointment?.name && slot.appointment?.email ? (
                  <>
                    <p className="text-sm">Booked by:</p>
                    <p className="text-sm text-primary">
                      {slot.appointment.name} ({slot.appointment.email})
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-red-400">Booked (no details)</p>
                )
              ) : (
                <p className="text-sm text-success">Available</p>
              )}
              {!slot.is_booked && (
                <button
                  onClick={() => handleDelete(slot.id)}
                  className="btn btn-xs btn-error mt-2"
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <FreelancerBranding onUpdate={() => setBrandingUpdated((n) => n + 1)} />
    </div>
  );
}
