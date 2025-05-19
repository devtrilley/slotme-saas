import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

export default function DevClientBookings() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [clientInfo, setClientInfo] = useState({
    name: location.state?.name || "Unknown Client",
    email: location.state?.email || "",
  });

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch bookings
  useEffect(() => {
    axios
      .get(`http://127.0.0.1:5000/dev/appointments/${clientId}`, {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then((res) => {
        setBookings(res.data);
        setError("");
      })
      .catch((err) => {
        console.error("❌ Failed to fetch bookings", err);
        setError("Failed to load client bookings.");
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  // Fallback to fetch client info if no location state
  useEffect(() => {
    if (!location.state) {
      axios
        .get(`http://127.0.0.1:5000/dev/clients/${clientId}`, {
          headers: {
            "X-Dev-Auth": "secret123",
          },
        })
        .then((res) => {
          setClientInfo({
            name: res.data.name,
            email: res.data.email,
          });
        })
        .catch((err) => {
          console.error("❌ Failed to fetch client info", err);
        });
    }
  }, [clientId, location.state]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">
        {clientInfo.name}'s Bookings
      </h2>
      {clientInfo.email && (
        <p className="text-center text-sm text-gray-400">{clientInfo.email}</p>
      )}

      {loading && <p className="text-center">Loading bookings...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      <div className="space-y-3">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="p-4 bg-base-200 rounded shadow-sm border"
          >
            <p>
              <strong>Name:</strong> {booking.name}
            </p>
            <p>
              <strong>Email:</strong> {booking.email}
            </p>
            <p>
              <strong>Time:</strong> {booking.slot_time}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/dev-admin")}
        className="btn btn-sm btn-outline w-full mt-4"
      >
        ⬅ Back to Admin Panel
      </button>
    </div>
  );
}