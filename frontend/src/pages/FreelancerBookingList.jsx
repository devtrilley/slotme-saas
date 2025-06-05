import { useEffect, useState } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { DateTime } from "luxon";

export default function FreelancerBookingList() {
  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [exportRange, setExportRange] = useState("selected_date");

  function parseLocalDate(str, timezone = "America/New_York") {
    return DateTime.fromISO(str).setZone(timezone).toJSDate();
  }

  function getESTDateString(date, timezone = "America/New_York") {
    return DateTime.fromJSDate(date).setZone(timezone).toFormat("yyyy-MM-dd");
  }

  const fetchAppointments = () => {
    axios
      .get("http://127.0.0.1:5000/appointments", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      .then((res) => {
        const sorted = [...res.data].sort(
          (a, b) => convertToDate(a.slot_time) - convertToDate(b.slot_time)
        );
        setAppointments(sorted);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch appointments:", err);
      });
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const convertToDate = (timeStr) => {
    const [t, mod] = timeStr.split(" ");
    let [h, m] = t.split(":").map(Number);
    if (mod === "PM" && h !== 12) h += 12;
    if (mod === "AM" && h === 12) h = 0;
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date;
  };

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

    try {
      await axios.patch(
        `http://127.0.0.1:5000/appointments/${id}`,
        {
          status: "cancelled",
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      alert("Appointment canceled.");
      fetchAppointments();
    } catch (err) {
      alert("Failed to cancel appointment.");
      console.error("Cancel error:", err);
    }
  };

  const filtered = appointments.filter((a) => {
    const timezone = a.freelancer_timezone || "America/New_York";

    const parsedSlotDate = parseLocalDate(a.slot_day, timezone);
    const dateString = getESTDateString(selectedDate, timezone);

    const matchesSearch = `${a.name} ${a.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const inTimeRange = isInTimeRange(a.slot_time);

    const inDate = DateTime.fromISO(a.slot_day)
      .setZone(timezone)
      .hasSame(DateTime.fromJSDate(selectedDate).setZone(timezone), "day");

    const isNotCancelled = a.status !== "cancelled"; // ✅ this line

    return matchesSearch && inTimeRange && inDate && isNotCancelled;
  });

  const exportCSV = () => {
    let exportData = appointments.filter((a) => a.status !== "cancelled");

    const timezone =
      exportData.find((a) => a.freelancer_timezone)?.freelancer_timezone ||
      "America/New_York";

    const today = DateTime.now().setZone(timezone);
    const isoToday = today.toISODate();

    if (exportRange === "this_month") {
      const thisMonth = today.month;
      const thisYear = today.year;
      exportData = exportData.filter((a) => {
        const date = DateTime.fromISO(a.slot_day).setZone(timezone);
        return date.month === thisMonth && date.year === thisYear;
      });
    } else if (exportRange === "last_month") {
      const lastMonthDate = today.minus({ months: 1 });
      const lastMonth = lastMonthDate.month;
      const lastYear = lastMonthDate.year;
      exportData = exportData.filter((a) => {
        const date = DateTime.fromISO(a.slot_day).setZone(timezone);
        return date.month === lastMonth && date.year === lastYear;
      });
    } else if (exportRange === "upcoming") {
      exportData = exportData.filter((a) => a.slot_day >= isoToday);
    } else if (exportRange === "selected_date") {
      const selectedStr = DateTime.fromJSDate(selectedDate)
        .setZone(timezone)
        .toFormat("yyyy-MM-dd");
      exportData = exportData.filter((a) => a.slot_day === selectedStr);
    }

    const header = "Name,Email,Date,Time Slot\n";
    const rows = exportData.map(
      (a) => `${a.name},${a.email},${a.slot_day},${a.slot_time}`
    );

    const csvContent = header + rows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (isoDate, timezone = "America/New_York") => {
    return DateTime.fromISO(isoDate).setZone(timezone).toFormat("MMMM d, yyyy");
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold text-center">
          Freelancer CRM: Bookings
        </h2>

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
          <option value="all">All Bookings</option>
          <option value="morning">Morning (Before 12PM)</option>
          <option value="afternoon">Afternoon (12PM–4PM)</option>
          <option value="evening">Evening (After 4PM)</option>
        </select>

        <label className="text-sm text-gray-400 block text-center mt-2">
          Filter by booking date:
        </label>

        <div className="relative w-full">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            className="input input-bordered w-full pl-10"
            wrapperClassName="w-full" // ✅ Fixes width!
            dateFormat="MMMM d, yyyy"
            placeholderText="Choose a date"
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            📅
          </span>
        </div>

        {selectedDate && (
          <button
            onClick={() => setSelectedDate(new Date())}
            className="btn btn-sm btn-outline w-full mt-2"
          >
            ❌ Clear Date Filter
          </button>
        )}

        <select
          className="select select-bordered w-full"
          value={exportRange}
          onChange={(e) => setExportRange(e.target.value)}
        >
          <option value="selected_date">📌 Exact Day (selected)</option>
          <option value="this_month">📆 This Month</option>
          <option value="last_month">🕰️ Last Month</option>
          <option value="upcoming">📈 Upcoming</option>
          <option value="all">🌍 All Bookings</option>
        </select>

        <button onClick={exportCSV} className="btn btn-outline w-full mt-2">
          📄 Export to CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center pt-4">No matching bookings.</p>
      ) : (
        filtered.map((a) => (
          <div
            key={a.id}
            className="p-4 border rounded-lg bg-base-200 shadow-sm space-y-2 mt-4"
          >
            <p className="text-xs text-gray-400">Appointment ID: {a.id}</p>
            <p>
              <strong>Name:</strong> {a.name}
            </p>
            <p>
              <strong>Email:</strong> {a.email}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {formatDate(a.slot_day, a.freelancer_timezone)}
            </p>
            <p>
              <strong>Time:</strong> {a.slot_time}
              <span className="ml-1 text-xs text-gray-400">
                {a.freelancer_timezone?.split("/")[1]?.replace("_", " ") ||
                  "Time Zone"}
              </span>
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
                ? "✔ Verified"
                : a.status === "cancelled"
                ? "✖ Cancelled"
                : "⚠ Unverified"}
            </p>
            <button
              className="btn btn-error btn-sm"
              onClick={() => handleCancel(a.id)}
            >
              Cancel
            </button>
          </div>
        ))
      )}
    </div>
  );
}
