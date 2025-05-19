// This is a React component that shows ALL time slots (booked or not).
// If booked, it shows who booked it (name + email); otherwise, it says "Available".

import { useEffect, useState } from "react";
import axios from "axios";

// Component for freelancers to brand themselves
import ClientBranding from "../components/ClientBranding";

// Helper to sort time strings properly
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

  useEffect(() => {
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
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
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

      {loading && <p className="text-center">Loading...</p>}
      {fetchError && <p className="text-red-500 text-center">{fetchError}</p>}

      <div className="space-y-4">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className="p-4 border rounded-lg bg-base-200 shadow-md"
          >
            <p className="font-semibold">{slot.time}</p>

            {slot.is_booked ? (
              slot.appointment &&
              slot.appointment.name &&
              slot.appointment.email ? (
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

      {/* Branding Preferences Form */}
      <ClientBranding />
    </div>
  );
}
