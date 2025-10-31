import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { API_BASE } from "../utils/constants";
import RefreshButton from "../components/Buttons/RefreshButton";
import { showToast } from "../utils/toast";
import IconDatePicker from "../components/Inputs/IconDatePicker";
import { useRef } from "react";
import {
  formatSlotTime,
  formatSlotDate,
  isSlotOnDate,
  getFreelancerDateString,
} from "../utils/timezoneHelpers";
import ReturnToTodayButton from "../components/Buttons/ReturnToTodayButton";

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
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [freelancerTimezone, setFreelancerTimezone] =
    useState("America/New_York");

  const handleRefresh = async () => {
    try {
      setFreelancerError("");
      setLoading(true);
      const res = await axios.get(`${API_BASE}/dev/slots/${freelancerId}`);
      setSlots(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch slots", err);
      setFreelancerError("Failed to load freelancer slots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh(); // central refresh logic on mount
  }, [freelancerId]);

  useEffect(() => {
    if (!location.state) {
      axios
        .get(`${API_BASE}/dev/freelancers/${freelancerId}`)
        .then((res) => {
          setFreelancerInfo({
            name: `${res.data.first_name} ${res.data.last_name}`,
            email: res.data.email,
          });
          setFreelancerTimezone(res.data.timezone || "America/New_York");
        })
        .catch((err) => {
          console.error("❌ Failed to fetch freelancer info", err);
        });
    } else {
      // Fetch timezone even if we have state
      axios
        .get(`${API_BASE}/dev/freelancers/${freelancerId}`)
        .then((res) => {
          setFreelancerTimezone(res.data.timezone || "America/New_York");
        })
        .catch((err) => {
          console.error("❌ Failed to fetch timezone", err);
        });
    }
  }, [freelancerId, location.state]);

  // Group slots by date
  const filteredSlots = selectedDate
    ? slots.filter((slot) =>
        isSlotOnDate(slot, selectedDate, freelancerTimezone)
      )
    : slots;

  const groupedSlots = filteredSlots.reduce((acc, slot) => {
    const dateKey = formatSlotDate(slot, freelancerTimezone);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(slot);
    return acc;
  }, {});

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold text-center">
        {freelancerInfo.name}'s Time Slots
      </h1>
      {freelancerInfo.email && (
        <p className="text-center text-sm text-gray-400">
          {freelancerInfo.email}
        </p>
      )}

      <button
        onClick={() => navigate("/dev-admin")}
        className="btn btn-sm btn-outline w-full mt-4"
      >
        ⬅️ Back to Admin Panel
      </button>

      <div className="flex justify-center">
        <RefreshButton
          onRefresh={handleRefresh}
          className="btn-sm"
          toastMessage="Refreshing slots..."
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <label className="text-sm text-gray-400">Select Date:</label>
        <IconDatePicker selected={selectedDate} onChange={setSelectedDate} />
        <ReturnToTodayButton onClick={() => setSelectedDate(new Date())} />
      </div>

      {loading && <p className="text-center">Loading slots...</p>}
      {freelancerError && (
        <p className="text-center text-red-500">{freelancerError}</p>
      )}

      {!loading && filteredSlots.length === 0 && (
        <p className="text-center text-gray-400">No slots for this date</p>
      )}

      <div className="space-y-4">
        {Object.entries(groupedSlots).map(([dateKey, dateSlots]) => (
          <div key={dateKey}>
            <h3 className="text-lg font-semibold mb-2 text-primary">
              {dateKey}
            </h3>
            <div className="space-y-2">
              {dateSlots.map((slot) => (
                <div
                  key={slot.id}
                  className={`p-4 rounded shadow-sm border ${
                    slot.is_booked
                      ? "bg-red-900/20 border-red-500"
                      : "bg-base-200"
                  }`}
                >
                  <p className="font-bold text-lg">
                    {formatSlotTime(slot, freelancerTimezone)}
                  </p>
                  <p className="text-sm">
                    <strong>Status:</strong>{" "}
                    {slot.is_booked ? (
                      <span className="text-red-500">Booked</span>
                    ) : (
                      <span className="text-green-500">Available</span>
                    )}
                  </p>
                  {slot.appointment && (
                    <div className="mt-2 text-sm space-y-1 border-t pt-2">
                      <p>
                        <strong>Client:</strong> {slot.appointment.name}
                      </p>
                      <p>
                        <strong>Email:</strong> {slot.appointment.email}
                      </p>
                      {slot.appointment.service && (
                        <p>
                          <strong>Service:</strong> {slot.appointment.service}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/dev-admin")}
        className="btn btn-sm btn-outline w-full mt-4"
      >
        ⬅️ Back to Admin Panel
      </button>
    </main>
  );
}
