import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TierStatusCard from "../components/Cards/TierStatusCard";
import { API_BASE } from "../utils/constants";
import { showToast } from "../utils/toast";

import { useFreelancer } from "../context/FreelancerContext";
import rawAxios from "axios";
import axios from "../utils/axiosInstance";

export default function UpgradeSuccess() {
  const { freelancer, setFreelancer } = useFreelancer();

  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    
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
        const res = await rawAxios.get(
          `${API_BASE}/stripe/check-session-status/${sessionId}`
        );
        const data = res.data;

        if (data.tier === "pro" || data.tier === "elite") {
          // ✅ CRITICAL FIX: Update BOTH tokens from payment verification
          // This prevents "session expired" errors for users who took >15min at Stripe
          if (data.access_token && data.refresh_token) {
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("refresh_token", data.refresh_token); // ✅ NEW
            
          } else if (data.access_token) {
            // Fallback for old backend (shouldn't happen after deploy)
            localStorage.setItem("access_token", data.access_token);
            
          }

          // 🔄 Refetch full freelancer info and update localStorage
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
          showToast(`Upgraded to ${data.tier.toUpperCase()}!`, "success");
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
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
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
    </main>
  );
}

// 1.	Backend – Signup Logic & Email Utils
// 	•	routes/auth_routes.py (freelancer signup endpoint)
// 	•	email_utils.py (to hook in verification email)
// 	•	config.py (to confirm FRONTEND/SMTP constants)
// 	2.	Frontend – Signup Form & Flow
// 	•	src/pages/Auth.jsx (signup UI + API call)
// 	•	src/utils/axiosInstance.js (so we can ensure correct base URL for verification link)
// 	•	src/pages/SignupConfirmed.jsx or EmailConfirmed.jsx (whichever exists for post-verification)
