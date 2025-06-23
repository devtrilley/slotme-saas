import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { API_BASE } from "../utils/constants";

export default function DevFreelancerSlots() {
  const { freelancerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Access freelancer name/email passed via state from DevAdmin
  const [freelancerInfo, setFreelancerInfo] = useState({
    name: location.state?.name || "Unknown freelancer",
    email: location.state?.email || "",
  });

  const [slots, setSlots] = useState([]);
  const [freelancerError, setFreelancerError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/dev/slots/${freelancerId}`, {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then((res) => {
        setSlots(res.data);
        setFreelancerError("");
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots", err);
        setFreelancerError("Failed to load freelancer slots.");
      })
      .finally(() => setLoading(false));
  }, [freelancerId]);

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
        {freelancerInfo.name}'s Time Slots
      </h2>
      {freelancerInfo.email && (
        <p className="text-center text-sm text-gray-400">
          {freelancerInfo.email}
        </p>
      )}
      
      <button
        onClick={() => navigate("/dev-admin")}
        className="btn btn-sm btn-outline w-full mt-4"
      >
        ⬅ Back to Admin Panel
      </button>

      {loading && <p className="text-center">Loading slots...</p>}
      {freelancerError && (
        <p className="text-center text-red-500">{freelancerError}</p>
      )}

      <div className="space-y-3">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className="p-4 bg-base-200 rounded shadow-sm border"
          >
            <p>
              <strong>Time:</strong> {slot.time}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {slot.is_booked ? (
                <span className="text-red-500">Booked</span>
              ) : (
                <span className="text-green-500">Available</span>
              )}
            </p>
            {slot.appointment && (
              <div className="mt-2 text-sm">
                <p>
                  <strong>Name:</strong> {slot.appointment.name}
                </p>
                <p>
                  <strong>Email:</strong> {slot.appointment.email}
                </p>
              </div>
            )}
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
