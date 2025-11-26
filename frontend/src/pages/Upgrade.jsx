import { useNavigate } from "react-router-dom";
import TierStatusCard from "../components/Cards/TierStatusCard";
import { useEffect, useState } from "react";
import { showToast } from "../utils/toast";
import BaseModal from "../components/Modals/BaseModal";
import slotmeLogo from "../assets/slotme-logo.svg";
import { useFreelancer } from "../context/FreelancerContext";
import axios from "../utils/axiosInstance";

export default function Upgrade() {
  const { freelancer } = useFreelancer();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();

  const tiers = [
    {
      name: "FREE",
      key: "free",
      bg: "bg-slate-800",
      text: "text-white",
      features: [
        { label: "Unlimited Bookings", value: true },
        { label: "Custom Branding (logo, bio, tagline)", value: true },
        { label: "Add Services to Booking Page", value: true },
        { label: "QR Code for Public Profile", value: true },
        { label: "No-Show Policy", value: true },
        { label: "Booking Analytics (CRM)", value: true },
        { label: "Custom URL (slotme.xyz/yourname)", value: false },
        { label: "Verified Badge", value: false },
        { label: "CSV Export", value: false },
        { label: "Custom Booking Questions", value: false },
        { label: "Priority Support", value: false },
        { label: "Early Feature Access", value: false },
      ],
    },
    {
      name: "PRO ($5/mo)",
      key: "pro",
      bg: "bg-purple-600",
      text: "text-white",
      features: [
        { label: "Unlimited Bookings", value: true },
        { label: "Custom Branding (logo, bio, tagline)", value: true },
        { label: "Add Services to Booking Page", value: true },
        { label: "QR Code for Public Profile", value: true },
        { label: "No-Show Policy", value: true },
        { label: "Booking Analytics (CRM)", value: true },
        { label: "Custom URL (slotme.xyz/yourname)", value: true },
        { label: "Verified Badge", value: true },
        { label: "CSV Export", value: true },
        { label: "Custom Booking Questions", value: true },
        { label: "Priority Support", value: false },
        { label: "Early Feature Access", value: false },
      ],
    },
    {
      name: "ELITE ($10/mo)",
      key: "elite",
      bg: "bg-indigo-600",
      text: "text-white",
      features: [
        { label: "Unlimited Bookings", value: true },
        { label: "Custom Branding (logo, bio, tagline)", value: true },
        { label: "Add Services to Booking Page", value: true },
        { label: "QR Code for Public Profile", value: true },
        { label: "No-Show Policy", value: true },
        { label: "Booking Analytics (CRM)", value: true },
        { label: "Custom URL (slotme.xyz/yourname)", value: true },
        { label: "Verified Badge", value: true },
        { label: "CSV Export", value: true },
        { label: "Custom Booking Questions", value: true },
        { label: "Priority Support", value: true },
        { label: "Early Feature Access", value: true },
      ],
    },
  ];

  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash.toLowerCase().startsWith("#elite")) {
      const el = document.getElementById("elite-tier");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring", "ring-yellow-400", "ring-offset-2");
        setTimeout(() => {
          el.classList.remove("ring", "ring-yellow-400", "ring-offset-2");
        }, 2000);
      }
    }
    if (hash.toLowerCase().startsWith("#pro")) {
      const el = document.getElementById("pro-tier");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const isLoggedIn = !!localStorage.getItem("access_token");
  const currentTier = (freelancer?.tier || "free").toLowerCase();

  // 🎯 TIER TRANSITION MATRIX - Single source of truth
  const getTierButton = (tierKey) => {
    if (!isLoggedIn) {
      return {
        text: tierKey === "free" ? "Try for Free" : "Upgrade",
        onClick: () => setShowLoginModal(true),
        className: "bg-white text-black font-semibold py-2 px-4 rounded-full",
      };
    }

    // Define all valid transitions
    const transitions = {
      free: {
        pro: { text: "Upgrade", plan: "pro", className: "bg-white text-black" },
        elite: {
          text: "Upgrade",
          plan: "elite",
          className: "bg-white text-black",
        },
      },
      pro: {
        elite: {
          text: "Upgrade",
          plan: "elite",
          className: "bg-white text-black",
        },
      },
      elite: {
        pro: {
          text: "Switch to Pro",
          plan: "pro",
          className: "bg-yellow-500 text-black",
        },
      },
    };

    const transition = transitions[currentTier]?.[tierKey];
    if (!transition) return null;

    return {
      text: transition.text,
      onClick: () => upgrade(transition.plan),
      className: `${transition.className} font-semibold py-2 px-4 rounded-full`,
    };
  };

  async function upgrade(plan) {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setShowLoginModal(true);
        return;
      }

      const res = await axios.post(`/stripe/create-checkout-session`, {
        plan,
        success_url: `${window.location.origin}/upgrade-success?session_id={CHECKOUT_SESSION_ID}`,
      });

      const data = res.data;

      if (data.url) {
        // Always go through Stripe Checkout
        showToast("Redirecting to Stripe...", "info", 4000);
        setTimeout(() => {
          window.location.href = data.url;
        }, 600);
      } else {
        showToast("Couldn't start checkout. Try again.", "error");
      }
    } catch (err) {
      console.error("❌ Stripe error:", err);
      showToast("Payment setup failed. Try again.", "error");
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-10">
      <h1 className="text-4xl font-bold text-center leading-tight">
        <div>
          <img
            src={slotmeLogo}
            alt="SlotMe Logo"
            className="h-22 sm:h-24 w-auto mx-auto"
          />
        </div>
        <div>Upgrade Your</div>
        <div className="text-5xl font-extrabold">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
            Experience
          </span>
        </div>
        <p className="text-lg text-gray-400 mt-4 italic">
          Unlock premium tools to save time and win clients.
        </p>
      </h1>

      {isLoggedIn && <TierStatusCard tier={freelancer?.tier} />}

      {showLoginModal && (
        <BaseModal
          title="Log in Required"
          body="Please log in to upgrade your plan."
          confirmText="Go to Login"
          onClose={() => setShowLoginModal(false)}
          onConfirm={() => {
            setShowLoginModal(false);
            window.location.href = "/auth?next=/upgrade";
          }}
        />
      )}

      {/* Mobile Cards */}
      <div className="flex flex-col md:hidden gap-6">
        {tiers.map((tier) => {
          const button = getTierButton(tier.key);
          return (
            <div
              key={tier.name}
              id={
                tier.key === "elite"
                  ? "elite-tier"
                  : tier.key === "pro"
                  ? "pro-tier"
                  : undefined
              }
              className={`rounded-2xl shadow-lg p-6 flex-1 text-center ${
                tier.bg
              } ${tier.text} ${
                isLoggedIn && currentTier === tier.key
                  ? "ring-2 ring-yellow-400 ring-offset-2"
                  : ""
              }`}
            >
              <h2 className="text-2xl font-extrabold mb-4">{tier.name}</h2>
              {button && (
                <button
                  onClick={button.onClick}
                  className={`${button.className} mb-2`}
                >
                  {button.text}
                </button>
              )}
              <ul className="space-y-2 text-left text-lg">
                {[...tier.features]
                  .sort((a, b) => (a.value === b.value ? 0 : a.value ? -1 : 1))
                  .map((feature, idx) => (
                    <li key={idx}>
                      • {feature.label}
                      <span className="ml-1">
                        {feature.value ? "✅" : "❌"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full mt-6 text-center border border-gray-700 rounded-lg overflow-hidden">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="py-3 px-4 text-left font-semibold">Feature</th>
              {tiers.map((t) => (
                <th key={t.name} className="py-3 px-4 font-semibold">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-slate-900 text-white divide-y divide-gray-700">
            {tiers[0].features.map((feat, idx) => (
              <tr key={idx}>
                <td className="py-3 px-4 text-left">{feat.label}</td>
                {tiers.map((t) => (
                  <td key={t.name} className="py-3 px-4">
                    {t.features[idx].value ? "✅" : "❌"}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="py-4 px-4 font-bold text-left">Upgrade</td>
              {tiers.map((t) => {
                const button = getTierButton(t.key);
                return (
                  <td key={t.name} className="py-4 px-4">
                    {button && (
                      <button
                        onClick={button.onClick}
                        className={button.className}
                      >
                        {button.text}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
