import { useEffect, useState } from "react";
import { useFreelancer } from "../context/FreelancerContext";
import axios from "../utils/axiosInstance";
import IconDatePicker from "../components/Inputs/IconDatePicker";
import { DateTime } from "luxon";
import { API_BASE } from "../utils/constants";
import { showToast } from "../utils/toast";
import RefreshButton from "../components/Buttons/RefreshButton";

export default function CRM() {
  const { freelancer } = useFreelancer();
  const tier = (freelancer?.tier || "free").toLowerCase();
  const canExport = tier === "pro" || tier === "elite";
  const next =
    window.location.pathname + window.location.search + window.location.hash;

  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [exportRange, setExportRange] = useState("selected_date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); // ✅ NEW

  function parseLocalDate(str, timezone = "America/New_York") {
    return DateTime.fromISO(str).setZone(timezone).toJSDate();
  }

  function getESTDateString(date, timezone = "America/New_York") {
    return DateTime.fromJSDate(date).setZone(timezone).toFormat("yyyy-MM-dd");
  }

  const convertToDate = (timeStr) => {
    const [t, mod] = timeStr.split(" ");
    let [h, m] = t.split(":").map(Number);
    if (mod === "PM" && h !== 12) h += 12;
    if (mod === "AM" && h === 12) h = 0;
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date;
  };

  const fetchAppointments = async () => {
    try {
      setError("");
      const res = await axios.get("/appointments");
      const sorted = [...res.data].sort(
        (a, b) => convertToDate(a.slot_time) - convertToDate(b.slot_time)
      );
      console.log("📥 Raw appointments:", res.data);
      setAppointments(sorted);
    } catch (err) {
      console.error("❌ Failed to fetch appointments:", err);
      setError("Failed to load your bookings. Please try again.");
    }
  };

  const handleRefresh = async () => {
    showToast("Refreshing bookings...", "refresh", 2000);
    await fetchAppointments();
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    setLoading(true);

    (async () => {
      try {
        await fetchAppointments();
      } catch (err) {
        console.error("🔥 Unexpected error in fetch:", err);
        setError("Something went wrong loading appointments.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isInTimeRange = (time) => {
    const hour = convertToDate(time).getHours();
    if (timeFilter === "morning") return hour < 12;
    if (timeFilter === "afternoon") return hour >= 12 && hour < 16;
    if (timeFilter === "evening") return hour >= 16;
    return true;
  };

  const handleCancel = async (id) => {
    const confirmCancel = confirm(
      "Are you sure you want to cancel this appointment?"
    );
    if (!confirmCancel) return;

    const token = localStorage.getItem("access_token");
    if (!token) return; // Block unauthorized cancellation

    try {
      await axios.patch(`/appointments/${id}`, {
        status: "cancelled",
      });
      showToast("✅ Appointment canceled.", "success");
      fetchAppointments();
    } catch (err) {
      showToast("❌ Failed to cancel appointment.", "error");
      console.error("Cancel error:", err);
    }
  };

  const filtered = appointments.filter((a) => {
    const timezone = a.freelancer_timezone || "America/New_York";

    const parsedSlotDate = parseLocalDate(a.slot_day, timezone);
    const dateString = getESTDateString(selectedDate, timezone);

    const matchesSearch = `${a.name} ${a.email}`
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase());

    const inTimeRange = isInTimeRange(a.slot_time);

    const inDate = DateTime.fromISO(a.slot_day)
      .setZone(timezone)
      .hasSame(DateTime.fromJSDate(selectedDate).setZone(timezone), "day");

    const isNotCancelled = a.status !== "cancelled"; // ✅ this line

    return matchesSearch && inTimeRange && inDate && isNotCancelled;
  });

  const exportCSV = async () => {
    if (!canExport) {
      showToast(
        "CSV export is a PRO/ELITE feature. Use the pill below to upgrade.",
        "error"
      );
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      showToast("You must be logged in to export.", "error");
      return;
    }

    try {
      showToast("⏳ Preparing your CSV export...", "info");

      const response = await axios.get(
        `${API_BASE}/appointments/export-csv?range=${exportRange}&selected_date=${getESTDateString(
          selectedDate
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "appointments.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();

      showToast("✅ Export ready! Download started.", "success");
    } catch (err) {
      if (err.response?.status === 403) {
        showToast(
          "🔒 CSV export is gated by your tier. Please upgrade.",
          "error"
        );
      } else {
        console.error("❌ CSV Export failed:", err);
        showToast("❌ Failed to export CSV. Please try again.", "error");
      }
    }
  };

  const formatDate = (isoDate, timezone = "America/New_York") => {
    return DateTime.fromISO(isoDate).setZone(timezone).toFormat("MMMM d, yyyy");
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-center">
        Freelancer CRM: Bookings
      </h2>

      {/* === Search + Time Filter FIRST === */}
      <div className="space-y-2">
        <label className="font-medium text-sm text-gray-400">
          Search & Time Filter:
        </label>
        <input
          type="text"
          placeholder="Search by name or email"
          className="input input-bordered w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="select select-bordered w-full"
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
        >
          <option value="all">All Times</option>
          <option value="morning">Morning (Before 12PM)</option>
          <option value="afternoon">Afternoon (12PM–4PM)</option>
          <option value="evening">Evening (After 4PM)</option>
        </select>
      </div>

      {/* === Filter by Booking Date BELOW that === */}
      <div className="space-y-2">
        <label className="font-medium text-sm text-gray-400">
          Filter by Booking Date:
        </label>

        {/* ✅ Wrap the picker in a div that controls the width */}
        <div className="w-full">
          <IconDatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="MMMM d, yyyy"
            placeholderText="Choose a date"
            className="input input-bordered w-full pl-10" // style the input
            wrapperClassName="w-full" // style the outer wrapper
          />
        </div>

        {/* ✅ Make sure this button uses w-full and consistent size */}
        <div className="w-full">
          <button
            onClick={() => setSelectedDate(new Date())}
            className="btn btn-outline w-full"
          >
            ⏮️ Return to Today
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <RefreshButton
          onRefresh={handleRefresh}
          className="btn-sm"
          toastMessage="Refreshing bookings..."
        />
      </div>

      {/* === Appointment Cards === */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-center text-sm text-gray-500 italic">Loading...</p>
        ) : error ? (
          <div className="text-center text-red-400 space-y-2 pt-4">
            <p>{error}</p>
            <button
              onClick={fetchAppointments}
              className="btn btn-sm btn-outline"
            >
              🔁 Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 pt-4">
            No matching bookings.
          </p>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              className="p-4 border rounded-lg bg-base-200 shadow-sm space-y-2"
            >
              <p className="text-xs text-gray-400">Appointment ID: {a.id}</p>
              <p>
                <strong>Name:</strong> {a.name || "Unknown"}
              </p>
              <p>
                <strong>Email:</strong> {a.email || "N/A"}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {formatDate(a.slot_day, a.freelancer_timezone)}
              </p>
              <p>
                <strong>Time:</strong> {a.slot_time || "?"}
                <span className="ml-1 text-xs text-gray-400">
                  {a.freelancer_timezone?.split("/")[1]?.replace("_", " ") ||
                    "Time Zone"}
                </span>
              </p>
              <p>
                <strong>Service:</strong> {a.service || "N/A"}
              </p>
              <p>
                <strong>Duration:</strong> {a.service_duration_minutes || "?"}{" "}
                minutes
              </p>
              <p
                className={`text-sm font-medium ${
                  a.status === "confirmed"
                    ? "text-success"
                    : a.status === "cancelled"
                    ? "text-error"
                    : "text-warning"
                }`}
              >
                {a.status === "confirmed"
                  ? "✔ Confirmed"
                  : a.status === "cancelled"
                  ? "✖ Cancelled"
                  : "⚠ Pending"}
              </p>
              {a.status === "confirmed" && (
                <button
                  className="btn btn-error btn-sm"
                  onClick={() => handleCancel(a.id)}
                >
                  Cancel
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* === Export Section === */}
      <div className="space-y-2 pt-6">
        <label className="font-medium text-sm text-gray-400">
          Export Bookings:
        </label>

        {!canExport && (
          <a
            href={`/upgrade#elite?need=pro&next=${encodeURIComponent(next)}`}
            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full
               bg-primary text-white border border-none shadow-inner
               hover:bg-primary transition mb-1.5"
          >
            🔒 Requires PRO (also in ELITE)
          </a>
        )}
        <div className="relative">
          {!canExport && (
            <button
              type="button"
              className="absolute inset-0 z-10 cursor-not-allowed rounded-lg"
              aria-label="Upgrade to enable CSV export"
              onClick={() =>
                showToast(
                  <span>
                    CSV export is a PRO/ELITE feature.{" "}
                    <a
                      href={`/upgrade#elite?need=pro&next=${encodeURIComponent(
                        next
                      )}`}
                      className="underline font-medium"
                    >
                      Upgrade →
                    </a>
                  </span>,
                  "error"
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  showToast("CSV export is locked on Free.", "error");
                }
              }}
            />
          )}

          <select
            className="select select-bordered w-full"
            value={exportRange}
            onChange={(e) => setExportRange(e.target.value)}
            disabled={!canExport}
            aria-disabled={!canExport}
            title={!canExport ? "Upgrade to enable CSV export" : undefined}
          >
            <option value="selected_date">📌 Exact Day (selected)</option>
            <option value="this_month">📆 This Month</option>
            <option value="last_month">🕰️ Last Month</option>
            <option value="upcoming">📈 Upcoming</option>
            <option value="all">🌍 All Bookings</option>
          </select>

          <button
            onClick={exportCSV}
            className="btn btn-outline w-full mt-2"
            disabled={!canExport}
            aria-disabled={!canExport}
            title={!canExport ? "Upgrade to enable CSV export" : undefined}
          >
            📄 Export to CSV
          </button>
        </div>
      </div>
    </div>
  );
}
