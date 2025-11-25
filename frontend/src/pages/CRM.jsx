import { useEffect, useState } from "react";
import { useFreelancer } from "../context/FreelancerContext";
import axios from "../utils/axiosInstance";
import IconDatePicker from "../components/Inputs/IconDatePicker";
import { DateTime } from "luxon";
import { API_BASE } from "../utils/constants";
import { showToast } from "../utils/toast";
import RefreshButton from "../components/Buttons/RefreshButton";
import ViewBookingModal from "../components/Modals/ViewBookingModal";
import ConfirmModal from "../components/Modals/ConfirmModal";
import SortButton from "../components/Buttons/SortButton";
import FilterButton from "../components/Buttons/FilterButton";
import ReturnToTodayButton from "../components/Buttons/ReturnToTodayButton";
import {
  getTimezoneAbbreviation,
  formatSlotTimeParts,
  formatSlotTimePartsFromUTC,
  formatSlotTimePartsFromLocal,
} from "../utils/timezoneHelpers";
import SafeLoader from "../components/Layout/SafeLoader";

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
  const [sortDirection, setSortDirection] = useState("asc");
  const [showFilters, setShowFilters] = useState(true);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exportRange, setExportRange] = useState("selected_date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); // ✅ NEW
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState(null);

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

  const handleCancel = async () => {
    if (!cancelTargetId) return;

    try {
      await axios.patch(`/appointments/${cancelTargetId}`, {
        status: "cancelled",
      });
      showToast("Appointment cancelled.", "success");
      fetchAppointments(); // Refresh CRM list
    } catch (err) {
      showToast("Couldn't cancel. Try again.", "error");
      console.error("Cancel error:", err);
    } finally {
      setCancelTargetId(null);
      setShowConfirmModal(false);
    }
  };

  const filtered = appointments.filter((a) => {
    const matchesSearch = `${a.name} ${a.email}`
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase());

    const inTimeRange = isInTimeRange(a.slot_time);

    const slotDate = a.slot_day;
    const selectedDateStr =
      DateTime.fromJSDate(selectedDate).toFormat("yyyy-MM-dd");
    const inDate = slotDate === selectedDateStr;

    // 🔥 Service filter
    const matchesService =
      serviceFilter === "all" || a.service === serviceFilter;

    // 🔥 Status filter (show all by default, let user filter)
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;

    return (
      matchesSearch && inTimeRange && inDate && matchesService && matchesStatus
    );
  });

  // 🔥 Sort filtered appointments
  const sortedFiltered = [...filtered].sort((a, b) => {
    const timeA = convertToDate(a.slot_time);
    const timeB = convertToDate(b.slot_time);
    return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
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
      showToast("Log in to export.", "warning");
      return;
    }

    try {
      showToast("Preparing CSV export...", "info");

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

      showToast("Export ready. Download started.", "success");
    } catch (err) {
      if (err.response?.status === 403) {
        showToast("CSV export requires PRO or ELITE.", "warning");
      } else {
        console.error("❌ CSV Export failed:", err);
        showToast("Export failed. Try again.", "error");
      }
    }
  };

  const formatDate = (isoDate) => {
    // ✅ slot_day is already local date, just format it
    return DateTime.fromISO(isoDate).toFormat("MMMM d, yyyy");
  };

  return (
    <SafeLoader loading={loading} error={error} onRetry={handleRefresh}>
      <main className="max-w-md mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center">
          Freelancer CRM: Bookings
        </h1>

        {/* === Search + Time Filter FIRST === */}
        <div className="space-y-2">
          <label className="font-medium text-sm text-gray-400">
            Search & Filters:
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
          <div className="flex justify-center w-full">
            <ReturnToTodayButton onClick={() => setSelectedDate(new Date())} />
          </div>

          {/* 🔥 Sort & Filter Toggle */}
          <div className="text-center mt-2">
            <button
              className="text-sm text-blue-400 hover:underline transition underline"
              onClick={() => setShowFilters((prev) => !prev)}
            >
              {showFilters ? "Hide Sort & Filter" : "Show Sort & Filter"}
            </button>
          </div>

          {/* 🔥 Sort & Filter Buttons */}
          {showFilters && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <div className="flex flex-col items-center w-full gap-1">
                <span className="text-sm text-gray-400">Sort:</span>
                <SortButton
                  direction={sortDirection}
                  onToggle={() =>
                    setSortDirection((prev) =>
                      prev === "asc" ? "desc" : "asc"
                    )
                  }
                />
              </div>

              <FilterButton
                label="Filter Service:"
                options={[
                  "all",
                  ...Array.from(
                    new Set(appointments.map((a) => a.service))
                  ).sort(),
                ]}
                value={serviceFilter}
                onChange={setServiceFilter}
              />

              <FilterButton
                label="Filter Status:"
                options={["all", "confirmed", "pending", "cancelled"]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          )}
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
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 pt-4">
              No matching bookings.
            </p>
          ) : (
            sortedFiltered.map((a) => {
              if (!a.freelancer_timezone) {
                console.warn("❌ Missing timezone on appointment:", a);
              }
              return (
                <div
                  key={a.id}
                  className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-md border border-slate-700 hover:shadow-lg hover:-translate-y-[1px] transition-all duration-150"
                >
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">#{a.id}</p>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        a.status === "confirmed"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : a.status === "cancelled"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                      }`}
                    >
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold text-white mt-1">
                    {a.name || "Unknown"}
                  </h2>
                  <p className="text-sm text-gray-400">{a.email || "N/A"}</p>

                  <div className="mt-3 text-sm space-y-1">
                    <p>
                      🗓{" "}
                      <span className="text-gray-300">
                        {formatDate(a.slot_day)}
                      </span>
                    </p>
                    <p>
                      ⏰{" "}
                      <span className="text-gray-300">
                        {a.slot_time}{" "}
                        <span className="text-xs text-gray-500">
                          {a.timezone_abbr}
                        </span>
                      </span>
                    </p>
                    <p>
                      💈{" "}
                      <span className="text-gray-300">
                        {a.service || "N/A"}
                      </span>{" "}
                      <span className="text-gray-500">
                        ({a.service_duration_minutes || "?"} min)
                      </span>
                    </p>
                  </div>
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

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      className="btn btn-primary btn-sm flex-1"
                      onClick={() => setSelectedAppointment(a)}
                    >
                      View Details
                    </button>

                    {a.status === "confirmed" && (
                      <button
                        className="btn btn-error btn-sm flex-1"
                        onClick={(e) => {
                          e.stopPropagation(); // prevent opening view modal
                          setCancelTargetId(a.id);
                          setShowConfirmModal(true);
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })
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
                    showToast("CSV export requires PRO or ELITE.", "warning");
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
              ⬇️ Export to CSV
            </button>
          </div>
        </div>

        {selectedAppointment && (
          <ViewBookingModal
            appointment={selectedAppointment}
            onClose={() => setSelectedAppointment(null)}
            onCancel={handleCancel}
          />
        )}

        {showConfirmModal && (
          <ConfirmModal
            title="Cancel Appointment?"
            message="Are you sure you want to cancel this appointment?"
            confirmText="Yes, Cancel It"
            cancelText="Keep Booking"
            onConfirm={handleCancel}
            onClose={() => {
              setCancelTargetId(null);
              setShowConfirmModal(false);
            }}
          />
        )}
      </main>
    </SafeLoader>
  );
}
