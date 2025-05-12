// This is a React component that fetches all booked appointments from the backend
// and displays them in a simple card layout.

/* WHAT IT DOES
  1.	Makes a GET request to http://127.0.0.1:5000/appointments when the page loads.
	2.	Stores the response in state (e.g., appointments).
	3.	Maps through and displays each booking (showing name, email, and time). 
*/

import { useEffect, useState } from "react";
import axios from "axios";

export default function BookingList() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    // Fetch all appointments from backend
    axios.get("http://127.0.0.1:5000/appointments")
      .then(res => {
        console.log("✅ Appointments fetched:", res.data);
        setAppointments(res.data);
      })
      .catch(err => {
        console.error("❌ Failed to fetch appointments:", err);
      });
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">All Bookings</h2>

      {appointments.length === 0 ? (
        <p className="text-center">No bookings yet.</p>
      ) : (
        appointments.map(app => (
          <div key={app.id} className="p-4 border rounded-lg shadow-md bg-base-200">
            <p><strong>Name:</strong> {app.name}</p>
            <p><strong>Email:</strong> {app.email}</p>
            <p><strong>Time Slot:</strong> {app.slot_time}</p>
          </div>
        ))
      )}
    </div>
  );
}