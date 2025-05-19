import { useEffect, useState } from "react";
import axios from "axios";
import ClientBranding from "../components/ClientBranding";
import { showToast } from "../utils/toast"; // adjust the path as needed
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
          "X-Client-ID": localStorage.getItem("client_id"),
        },
      })
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => {
          return getDateFromTimeStr(a.time) - getDateFromTimeStr(b.time);
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

  useEffect(() => {
    fetchSlots();
    axios
      .get("http://127.0.0.1:5000/client-info", {
        headers: { "X-Client-ID": localStorage.getItem("client_id") },
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
  }, []);

  const shareUrl = `http://localhost:5173/book/${localStorage.getItem(
    "client_id"
  )}`;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 items-center">
        <h2 className="text-2xl font-bold text-center">
          Client Admin Dashboard
        </h2>
        <button
          onClick={() => {
            localStorage.removeItem("client_logged_in");
            window.location.href = "/client-login";
          }}
          className="btn btn-sm btn-outline"
        >
          Logout
        </button>
      </div>

      {/* Branding Preview */}
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

      {/* Shareable Link */}
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

      {/* Add Time Slot Form */}
      <AddSlotForm onAdd={fetchSlots} />

      {/* Time Slots */}
      {loading && <p className="text-center">Loading...</p>}
      {fetchError && <p className="text-red-500 text-center">{fetchError}</p>}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-center border-b pb-1">
          Your Time Slots
        </h3>

        {slots.map((slot) => (
          <div
            key={slot.id}
            className="p-4 border rounded-lg bg-base-100 shadow-sm"
          >
            <p className="font-semibold">{slot.time}</p>

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
          </div>
        ))}
      </div>

      {/* Branding Form */}
      <ClientBranding />
    </div>
  );
}
