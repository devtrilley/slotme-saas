import { useEffect, useState } from "react";
import axios from "../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import ServiceRevenueChart from "../components/Charts/ServiceRevenueChart";
import BookingsPerServiceChart from "../components/Charts/BookingsPerServiceChart";
import BookingTrendChart from "../components/Charts/BookingTrendChart";
import StatsSummaryCard from "../components/Cards/StatsSummaryCard";
import { API_BASE } from "../utils/constants";
import SafeLoader from "../components/Layout/SafeLoader";
import { showToast } from "../utils/toast";
import RefreshButton from "../components/Buttons/RefreshButton";

export default function FreelancerAnalytics() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const freelancerId = localStorage.getItem("freelancer_id");

    if (!token || !freelancerId) {
      navigate("/auth");
      return;
    }

    fetchStats();
  }, [navigate]);

  const fetchStats = () => {
    showToast("Refreshing stats...", "refresh", 2000);
    axios
      .get(`${API_BASE}/freelancer/analytics`)
      .then((res) => {
        setStats(res.data);
      })
      .catch((err) => {
        console.error("❌ Failed to load analytics", err);
        setError("Failed to load analytics.");
      });
  };

  return (
    <SafeLoader loading={!stats && !error} error={error} onRetry={fetchStats}>
      <main className="max-w-md mx-auto p-6 space-y-6 text-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Your Analytics</h1>
          <RefreshButton
            onRefresh={fetchStats}
            toastMessage="Refreshing stats..."
            className="btn-sm"
          />
        </div>

        {stats && (
          <>
            <StatsSummaryCard stats={stats} />

            <BookingsPerServiceChart data={stats.bookings_per_service} />

            {stats.booking_trend?.length > 0 && (
              <BookingTrendChart
                trendData={stats.booking_trend}
                signupDate={stats.signup_date}
              />
            )}

            <ServiceRevenueChart data={stats.service_revenue} />

            {stats.service_revenue?.length === 0 && (
              <p className="text-sm text-center text-gray-400 italic">
                No revenue data yet.
              </p>
            )}
          </>
        )}
      </main>
    </SafeLoader>
  );
}
