import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { API_BASE } from "../utils/constants";

export default function DevFreelancerBookings() {
  const { freelancerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [freelancerInfo, setFreelancerInfo] = useState({
    name: location.state?.name || "Unknown freelancer",
    email: location.state?.email || "",
  });

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch bookings
  useEffect(() => {
    axios
      .get(`${API_BASE}/dev/appointments/${freelancerId}`, {
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
        setError("Failed to load freelancer bookings.");
      })
      .finally(() => setLoading(false));
  }, [freelancerId]);

  // Fallback to fetch freelancer info if no location state
  useEffect(() => {
    if (!location.state) {
      axios
        .get(`${API_BASE}/dev/freelancers/${freelancerId}`, {
          headers: {
            "X-Dev-Auth": "secret123",
          },
        })
        .then((res) => {
          setFreelancerInfo({
            name: `${res.data.first_name} ${res.data.last_name}`,
            email: res.data.email,
          });
        })
        .catch((err) => {
          console.error("❌ Failed to fetch freelancer info", err);
        });
    }
  }, [freelancerId, location.state]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">
        {freelancerInfo.name}'s Bookings
      </h2>
      {freelancerInfo.email && (
        <p className="text-center text-sm text-gray-400">
          {freelancerInfo.email}
        </p>
      )}

      {loading && <p className="text-center">Loading bookings...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      <button
        onClick={() => navigate("/dev-admin")}
        className="btn btn-sm btn-outline w-full mt-4"
      >
        ⬅ Back to Admin Panel
      </button>

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
