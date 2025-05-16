import { useEffect, useState } from "react";
import axios from "axios";

export default function ClientBookingList() {
  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/appointments")
      .then((res) => {
        const sorted = [...res.data].sort((a, b) =>
          convertToDate(a.slot_time) - convertToDate(b.slot_time)
        );
        setAppointments(sorted);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch appointments:", err);
      });
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
    return true; // "all"
  };

  const filtered = appointments.filter((a) => {
    const matchesSearch = `${a.name} ${a.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesSearch && isInTimeRange(a.slot_time);
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

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold text-center">Client CRM: Bookings</h2>

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
            className="p-4 border rounded-lg bg-base-200 shadow-sm space-y-1 mt-4"
          >
            <p>
              <strong>Name:</strong> {a.name}
            </p>
            <p>
              <strong>Email:</strong> {a.email}
            </p>
            <p>
              <strong>Time:</strong> {a.slot_time}
            </p>
          </div>
        ))
      )}
    </div>
  );
}