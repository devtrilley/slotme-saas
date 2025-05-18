import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

export default function DevClientSlots() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Access client name/email passed via state from DevAdmin
  const [clientInfo, setClientInfo] = useState({
    name: location.state?.name || "Unknown Client",
    email: location.state?.email || "",
  });

  const [slots, setSlots] = useState([]);
  const [clientError, setClientError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`http://127.0.0.1:5000/dev/slots/${clientId}`, {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then((res) => {
        setSlots(res.data);
        setClientError("");
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots", err);
        setClientError("Failed to load client slots.");
      })
      .finally(() => setLoading(false));
  }, [clientId]);

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
        {clientInfo.name}'s Time Slots
      </h2>
      {clientInfo.email && (
        <p className="text-center text-sm text-gray-400">{clientInfo.email}</p>
      )}

      {loading && <p className="text-center">Loading slots...</p>}
      {clientError && <p className="text-center text-red-500">{clientError}</p>}

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
