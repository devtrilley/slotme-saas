import { useEffect, useState } from "react";
import axios from "axios";

export default function FreelancerBookingList() {
  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  const fetchAppointments = () => {
    axios
      .get("http://127.0.0.1:5000/appointments", {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
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
      await axios.delete(`http://127.0.0.1:5000/appointments/${id}`, {
        headers: { "X-Freelancer-ID": localStorage.getItem("freelancer_id") },
      });
      alert("Appointment canceled.");
      fetchAppointments(); // 🔄 Refresh list
    } catch (err) {
      alert("Failed to cancel appointment.");
      console.error("Cancel error:", err);
    }
  };

  const filtered = appointments.filter((a) => {
    const matchesSearch = `${a.name} ${a.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const inTimeRange = isInTimeRange(a.slot_time);

    const inDate = selectedDate ? a.slot_day === selectedDate : true;

    return matchesSearch && inTimeRange && inDate;
  });

  const exportCSV = () => {
    const header = "Name,Email,Time Slot\n";
    const rows = filtered.map((a) => `${a.name},${a.email},${a.slot_time}`);
    const csvContent = header + rows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "bookings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (isoDate) => {
    const dateObj = new Date(isoDate);
    const options = { year: "numeric", month: "long", day: "numeric" };
    return dateObj.toLocaleDateString(undefined, options); // e.g. May 24, 2025
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
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input input-bordered w-full"
        />
        {selectedDate && (
          <button
            onClick={() => setSelectedDate("")}
            className="btn btn-sm btn-outline w-full mt-2"
          >
            ❌ Clear Date Filter
          </button>
        )}

        <button onClick={exportCSV} className="btn btn-outline w-full">
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
            <p>
              <strong>Name:</strong> {a.name}
            </p>
            <p>
              <strong>Email:</strong> {a.email}
            </p>
            <p>
              <strong>Date:</strong> {formatDate(a.slot_day)}
            </p>
            <p>
              <strong>Time:</strong>{" "}
              {a.slot_time}
              <span className="ml-1 text-xs text-gray-400">EST</span>
            </p>
            <p
              className={`text-sm font-medium ${
                a.confirmed ? "text-success" : "text-warning"
              }`}
            >
              {a.confirmed ? "✔ Verified" : "⚠ Unverified"}
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