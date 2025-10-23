import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { API_BASE } from "../utils/constants";
import RefreshButton from "../components/Buttons/RefreshButton";
import { showToast } from "../utils/toast";
import IconDatePicker from "../components/Inputs/IconDatePicker";
import { DateTime } from "luxon";
import { useRef } from "react";
import ReturnToTodayButton from "../components/Buttons/ReturnToTodayButton";


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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [freelancerTimezone, setFreelancerTimezone] =
    useState("America/New_York");

  const handleRefresh = async () => {
    try {
      setError("");
      setLoading(true);
      const res = await axios.get(
        `${API_BASE}/dev/appointments/${freelancerId}`
      );
      setBookings(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch bookings", err);
      setError("Failed to load freelancer bookings.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch bookings
  useEffect(() => {
    handleRefresh(); // cleaner
  }, [freelancerId]);

  // Fallback to fetch freelancer info if no location state
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

  // Helper to parse booking slot time and format it
  const formatBookingTime = (booking) => {
    try {
      // Try 12-hour format with zero-padding first
      let utcDateTime = DateTime.fromFormat(
        `${booking.slot_day} ${booking.slot_time}`,
        "yyyy-MM-dd hh:mm a",
        { zone: "UTC" }
      );

      // Try without zero-padding if that fails
      if (!utcDateTime.isValid) {
        utcDateTime = DateTime.fromFormat(
          `${booking.slot_day} ${booking.slot_time}`,
          "yyyy-MM-dd h:mm a",
          { zone: "UTC" }
        );
      }

      if (!utcDateTime.isValid) return booking.slot_time;

      const localTime = utcDateTime.setZone(freelancerTimezone);
      return localTime.toFormat("h:mm a ZZZZ");
    } catch {
      return booking.slot_time;
    }
  };

  const formatBookingDate = (booking) => {
    try {
      let utcDateTime = DateTime.fromFormat(
        `${booking.slot_day} ${booking.slot_time}`,
        "yyyy-MM-dd hh:mm a",
        { zone: "UTC" }
      );

      if (!utcDateTime.isValid) {
        utcDateTime = DateTime.fromFormat(
          `${booking.slot_day} ${booking.slot_time}`,
          "yyyy-MM-dd h:mm a",
          { zone: "UTC" }
        );
      }

      if (!utcDateTime.isValid) return booking.slot_day;

      const localTime = utcDateTime.setZone(freelancerTimezone);
      return localTime.toFormat("EEE, MMM d, yyyy");
    } catch {
      return booking.slot_day;
    }
  };

  // Filter bookings by date if one is selected
  const filteredBookings = selectedDate
    ? bookings.filter((booking) => {
        try {
          let utcDateTime = DateTime.fromFormat(
            `${booking.slot_day} ${booking.slot_time}`,
            "yyyy-MM-dd hh:mm a",
            { zone: "UTC" }
          );

          if (!utcDateTime.isValid) {
            utcDateTime = DateTime.fromFormat(
              `${booking.slot_day} ${booking.slot_time}`,
              "yyyy-MM-dd h:mm a",
              { zone: "UTC" }
            );
          }

          if (!utcDateTime.isValid) return false;

          const localTime = utcDateTime.setZone(freelancerTimezone);
          const selectedDt =
            DateTime.fromJSDate(selectedDate).setZone(freelancerTimezone);
          return localTime.hasSame(selectedDt, "day");
        } catch {
          return false;
        }
      })
    : bookings;

  // Group by date
  const groupedBookings = filteredBookings.reduce((acc, booking) => {
    const dateKey = formatBookingDate(booking);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(booking);
    return acc;
  }, {});

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
          toastMessage="Refreshing bookings..."
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <label className="text-sm text-gray-400">
          Filter by Date (optional):
        </label>
        <IconDatePicker selected={selectedDate} onChange={setSelectedDate} />
        <ReturnToTodayButton onClick={() => setSelectedDate(new Date())} />
      </div>

      {loading && <p className="text-center">Loading bookings...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {!loading && filteredBookings.length === 0 && (
        <p className="text-center text-gray-400">
          {selectedDate ? "No bookings for this date" : "No bookings found"}
        </p>
      )}

      <div className="space-y-4">
        {Object.entries(groupedBookings).map(([dateKey, dateBookings]) => (
          <div key={dateKey}>
            <h3 className="text-lg font-semibold mb-2 text-primary">
              {dateKey}
            </h3>
            <div className="space-y-2">
              {dateBookings.map((booking) => (
                <div
                  key={booking.id}
                  className={`p-4 rounded shadow-sm border ${
                    booking.status === "confirmed"
                      ? "bg-green-900/20 border-green-500"
                      : booking.status === "pending"
                      ? "bg-yellow-900/20 border-yellow-500"
                      : "bg-red-900/20 border-red-500"
                  }`}
                >
                  <p className="font-bold text-lg">
                    {formatBookingTime(booking)}
                  </p>
                  <p className="text-sm mt-1">
                    <strong>Client:</strong> {booking.name}
                  </p>
                  <p className="text-sm">
                    <strong>Email:</strong> {booking.email}
                  </p>
                  {booking.service && (
                    <p className="text-sm">
                      <strong>Service:</strong> {booking.service}
                      {booking.service_duration_minutes && (
                        <span className="text-gray-400">
                          {" "}
                          ({booking.service_duration_minutes} min)
                        </span>
                      )}
                    </p>
                  )}
                  <p className="text-sm">
                    <strong>Status:</strong>{" "}
                    <span
                      className={
                        booking.status === "confirmed"
                          ? "text-green-400 font-semibold"
                          : booking.status === "pending"
                          ? "text-yellow-400 font-semibold"
                          : "text-red-400 font-semibold"
                      }
                    >
                      {booking.status.charAt(0).toUpperCase() +
                        booking.status.slice(1)}
                    </span>
                  </p>
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
    </div>
  );
}
