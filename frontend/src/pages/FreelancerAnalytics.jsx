import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ResponsiveLine } from "@nivo/line";
import ServiceRevenueChart from "../components/ServiceRevenueChart";
import { RefreshCcw } from "lucide-react"; // ✅ Icon from lucide
import BookingsPerServiceChart from "../components/BookingsPerServiceChart";
import BookingTrendChart from "../components/BookingTrendChart";
import StatsSummaryCard from "../components/StatsSummaryCard";
import AnalyticsSkeleton from "../components/AnalyticsSkeleton";


const colorMap = {
  "Happy Ending Herbal Rubdown": "#EF4444",
  "O'Breezy Prezidential Fade": "#22C55E",
  "Thai Five-Hand Combo": "#F59E0B",
};

export default function FreelancerAnalytics() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const freelancerId = localStorage.getItem("freelancer_id");

  const fetchStats = () => {
    console.log("🔁 Refresh button clicked");
    axios
      .get("http://127.0.0.1:5000/freelancer/analytics", {
        headers: { "X-Freelancer-ID": freelancerId },
      })
      .then((res) => {
        console.log("📊 Refetched stats:", res.data);
        setStats(res.data);
      })
      .catch((err) => {
        console.error("❌ Failed to load analytics", err);
        setError("Failed to load analytics.");
      });
  };

  useEffect(() => {
    if (!freelancerId) {
      navigate("/auth");
      return;
    }
    fetchStats(); // initial load
  }, [freelancerId, navigate]);

  if (error) return <p className="text-center text-red-500">{error}</p>;
  if (!stats) return <AnalyticsSkeleton />;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-white">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Your Analytics</h1>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-200 transition"
        >
          <RefreshCcw size={16} /> Refresh Data
        </button>
      </div>

      {/* Card 1: Stats */}
      <StatsSummaryCard stats={stats} />

      {/* Card 2: Pie Chart */}
      <BookingsPerServiceChart data={stats.bookings_per_service} />

      {/* Card 3: Booking Trend (Line Chart) */}
      {stats.booking_trend?.length > 0 && (
        <BookingTrendChart
          trendData={stats.booking_trend}
          signupDate={stats.signup_date}
        />
      )}

      {/* Card 4: A chart comp for revenue by service */}
      <ServiceRevenueChart data={stats.service_revenue} />

      <button
        onClick={() => navigate("/freelancer-admin")}
        className="btn btn-outline w-full mt-4"
      >
        Go to Admin Page
      </button>
    </div>
  );
}
