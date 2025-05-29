import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function FreelancerAnalytics() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const freelancerId = localStorage.getItem("freelancer_id");

  useEffect(() => {
    if (!freelancerId) {
      navigate("/auth");
      return;
    }

    axios
      .get("http://127.0.0.1:5000/freelancer/analytics", {
        headers: { "X-Freelancer-ID": freelancerId },
      })
      .then((res) => setStats(res.data))
      .catch((err) => {
        console.error("❌ Failed to load analytics", err);
        setError("Failed to load analytics.");
      });
  }, [freelancerId, navigate]);

  if (error) return <p className="text-center text-red-500">{error}</p>;
  if (!stats) return <p className="text-center">Loading analytics...</p>;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-white">
      <h1 className="text-2xl font-bold text-center">Your Analytics</h1>

      <div className="bg-white/5 rounded-lg p-4 shadow space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Total Bookings:</span>
          <span className="font-bold">{stats.total_bookings}</span>
        </div>

        <div className="flex justify-between">
          <span>Confirmed Bookings:</span>
          <span className="font-bold">{stats.confirmed}</span>
        </div>

        <div className="flex justify-between">
          <span>Cancelled Bookings:</span>
          <span className="font-bold">{stats.cancelled}</span>
        </div>

        {stats.top_service && (
          <div className="mt-4 text-sm text-left">
            <p className="text-white">Most Booked Service:</p>
            <p className="font-semibold mt-1">"{stats.top_service}"</p>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/freelancer-admin")}
        className="btn btn-outline w-full mt-4"
      >
        Go to Admin Page
      </button>
    </div>
  );
}