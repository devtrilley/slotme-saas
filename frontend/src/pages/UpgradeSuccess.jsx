import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TierStatusCard from "../components/Cards/TierStatusCard";
import { API_BASE } from "../utils/constants";
import { showToast } from "../utils/toast";

import { useFreelancer } from "../context/FreelancerContext";
import axios from "../utils/axiosInstance"; // ✅ at the top

export default function UpgradeSuccess() {
  const { freelancer, setFreelancer } = useFreelancer();

  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🔥 checkTier useEffect ran");
    const checkTier = async () => {
      const sessionId = new URLSearchParams(window.location.search).get(
        "session_id"
      );
      const token = localStorage.getItem("access_token");

      if (!sessionId || !token) {
        navigate("/upgrade-cancelled");
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/stripe/check-session-status/${sessionId}`
        );

        const data = await res.json();

        if (res.ok && (data.tier === "pro" || data.tier === "elite")) {
          // 🔄 Refetch full freelancer info and update localStorage

          // Inside your try block:
          const infoRes = await axios.get("/freelancer-info");
          const infoData = infoRes.data;

          if (infoData.tier !== data.tier) {
            console.warn(
              "⚠️ Mismatch between backend tier and Stripe tier:",
              infoData.tier,
              data.tier
            );
          }

          localStorage.setItem("freelancer", JSON.stringify(infoData));
          setFreelancer(infoData);

          // ✅ Show toast after update
          showToast(`Plan upgraded to ${data.tier.toUpperCase()}!`);
        } else {
          navigate("/upgrade-cancelled");
        }
      } catch (err) {
        console.error("❌ Error verifying session:", err);
        navigate("/upgrade-cancelled");
      } finally {
        setLoading(false);
      }
    };

    checkTier();
  }, [navigate, setFreelancer]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p className="text-lg">Verifying your upgrade...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">🎉 Upgrade Successful!</h1>
        <p className="text-lg">Thank you for upgrading your SlotMe plan.</p>

        <div className="max-w-xs mx-auto">
          <TierStatusCard tier={freelancer?.tier || "free"} />
        </div>

        <a
          onClick={() => navigate("/freelancer-admin")}
          className="inline-block bg-white text-black px-4 py-2 rounded-lg font-semibold"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
