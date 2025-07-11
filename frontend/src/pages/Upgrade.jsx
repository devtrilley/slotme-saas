import { useNavigate } from "react-router-dom";
import TierStatusCard from "../components/TierStatusCard";
import { useEffect, useState } from "react";
import { API_BASE } from "../utils/constants";
import { showToast } from "../utils/toast";
import GeneralModal from "../components/GeneralModal";
import slotmeLogo from "../assets/slotme-logo.svg";

import { useFreelancer } from "../context/FreelancerContext";
import axios from "../utils/axiosInstance";

export default function Upgrade() {
  const { freelancer, setFreelancer } = useFreelancer();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const tiers = [
    {
      name: "FREE",
      bg: "bg-slate-800",
      text: "text-white",
      features: [
        { label: "Unlimited Bookings", value: true },
        { label: "Custom Branding (logo, bio, etc.)", value: true },
        { label: "Add Services to Booking Page", value: true },
        { label: "QR Code for Public Profile", value: true },
        { label: "Freelancer-Defined No-Show Policy", value: true },
        { label: "Booking Analytics (basic)", value: true },
        { label: "Booking Page Custom URL", value: false },
        { label: "Verified Badge", value: false },
        { label: "Priority Support", value: false },
        { label: "Export Bookings to CSV", value: false },
        { label: "Email Reminders to Clients", value: false },
        { label: "SMS Reminders to Clients", value: false },
        { label: "Early Feature Access", value: false },
        { label: "Calendar Sync (Google, Apple, etc.)", value: false },
      ],
    },
    {
      name: "PRO ($5/mo)",
      bg: "bg-purple-600",
      text: "text-white",
      features: [
        { label: "Unlimited Bookings", value: true },
        { label: "Custom Branding (logo, bio, etc.)", value: true },
        { label: "Add Services to Booking Page", value: true },
        { label: "QR Code for Public Profile", value: true },
        { label: "Freelancer-Defined No-Show Policy", value: true },
        { label: "Booking Analytics (full)", value: true },
        { label: "Booking Page Custom URL", value: true },
        { label: "Verified Badge", value: true },
        { label: "Priority Support", value: false },
        { label: "Export Bookings to CSV", value: true },
        { label: "Email Reminders to Clients", value: true },
        { label: "SMS Reminders to Clients", value: true },
        { label: "Early Feature Access", value: false },
        { label: "Calendar Sync (Google, Apple, etc.)", value: false },
      ],
    },
    {
      name: "ELITE ($10/mo)",
      bg: "bg-indigo-600",
      text: "text-white",
      features: [
        { label: "Unlimited Bookings", value: true },
        { label: "Custom Branding (logo, bio, etc.)", value: true },
        { label: "Add Services to Booking Page", value: true },
        { label: "QR Code for Public Profile", value: true },
        { label: "Freelancer-Defined No-Show Policy", value: true },
        { label: "Booking Analytics (full)", value: true },
        { label: "Booking Page Custom URL", value: true },
        { label: "Verified Badge", value: true },
        { label: "Priority Support", value: true },
        { label: "Export Bookings to CSV", value: true },
        { label: "Email Reminders to Clients", value: true },
        { label: "SMS Reminders to Clients", value: true },
        { label: "Early Feature Access", value: true },
        { label: "Calendar Sync (Google, Apple, etc.)", value: true },
      ],
    },
  ];

  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#elite") {
      const eliteSection = document.getElementById("elite-tier");
      if (eliteSection) {
        eliteSection.scrollIntoView({ behavior: "smooth", block: "start" });
        eliteSection.classList.add("ring", "ring-yellow-400", "ring-offset-2");
        setTimeout(() => {
          eliteSection.classList.remove(
            "ring",
            "ring-yellow-400",
            "ring-offset-2"
          );
        }, 2000);
      }
    }
  }, []);

  const isLoggedIn = !!localStorage.getItem("access_token");
  const currentTier = (freelancer?.tier || "").toLowerCase();

  async function upgrade(plan) {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setShowLoginModal(true);
        return;
      }

      const res = await axios.post(`/create-checkout-session`, {
        plan,
        success_url: `${window.location.origin}/upgrade-success?session_id={CHECKOUT_SESSION_ID}`,
      });

      const data = res.data;
      if (data.url) {
        showToast("Redirecting you to Stripe...", "success", 4000); // ✅ Toast here
        setTimeout(() => {
          window.location.href = data.url; // ✅ Delayed redirect
        }, 600); // give toast ~0.6s to render
      } else {
        alert("Failed to create checkout session.");
      }
    } catch (err) {
      console.error("❌ Stripe error:", err);
      alert("Something went wrong. Try again.");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
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
          <span className="text-gray-100 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
            Experience
          </span>
        </div>

        <p className="text-lg text-gray-400 mt-4 italic">
          Unlock premium tools to save time and win clients.
        </p>
      </h1>

      {isLoggedIn && <TierStatusCard tier={freelancer?.tier} />}

      {showLoginModal && (
        <GeneralModal
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

      {/* Cards: visible only on mobile */}
      <div className="flex flex-col md:hidden gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            id={tier.name.includes("ELITE") ? "elite-tier" : undefined} // ✅ Add this line
            className={`rounded-2xl shadow-lg p-6 flex-1 text-center ${
              tier.bg
            } ${tier.text} ${
              isLoggedIn &&
              currentTier === tier.name.split(" ")[0].toLowerCase()
                ? "ring-2 ring-yellow-400 ring-offset-2"
                : ""
            }`}
          >
            <h2 className="text-2xl font-extrabold mb-4">{tier.name}</h2>
            {!isLoggedIn ? (
              <button
                onClick={() => setShowLoginModal(true)}
                className="bg-white text-black font-semibold py-2 px-4 rounded-full mb-2"
              >
                {tier.name.includes("FREE")
                  ? "Try for Free"
                  : "Upgrade to " + tier.name.split(" ")[0]}
              </button>
            ) : (
              <>
                {tier.name.includes("PRO") &&
                  currentTier !== "pro" &&
                  currentTier !== "elite" && (
                    <button
                      onClick={() => upgrade("pro")}
                      className="bg-white text-black font-semibold py-2 px-4 rounded-full mb-2"
                    >
                      Upgrade to PRO
                    </button>
                  )}

                {tier.name.includes("ELITE") && currentTier !== "elite" && (
                  <button
                    onClick={() => upgrade("elite")}
                    className="bg-white text-black font-semibold py-2 px-4 rounded-full mb-2"
                  >
                    Upgrade to ELITE
                  </button>
                )}
              </>
            )}
            <ul className="space-y-2 text-left text-lg">
              {[...tier.features]
                .sort((a, b) => (a.value === b.value ? 0 : a.value ? -1 : 1))
                .map((feature, idx) => (
                  <li key={idx}>
                    • {feature.label}
                    <span className="ml-1">{feature.value ? "✅" : "❌"}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Table: visible on md+ screens only */}
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
                const tierKey = t.name.split(" ")[0].toLowerCase();

                if (!isLoggedIn) {
                  return (
                    <td key={t.name} className="py-4 px-4">
                      <button
                        onClick={() => setShowLoginModal(true)}
                        className="bg-white text-black font-semibold py-2 px-4 rounded-full"
                      >
                        {tierKey === "free" ? "Try for Free" : "Upgrade"}
                      </button>
                    </td>
                  );
                }

                if (
                  tierKey === "pro" &&
                  currentTier !== "pro" &&
                  currentTier !== "elite"
                ) {
                  return (
                    <td key={t.name} className="py-4 px-4">
                      <button
                        onClick={() => upgrade("pro")}
                        className="bg-white text-black font-semibold py-2 px-4 rounded-full"
                      >
                        Upgrade
                      </button>
                    </td>
                  );
                }

                if (tierKey === "elite" && currentTier !== "elite") {
                  return (
                    <td key={t.name} className="py-4 px-4">
                      <button
                        onClick={() => upgrade("elite")}
                        className="bg-white text-black font-semibold py-2 px-4 rounded-full"
                      >
                        Upgrade
                      </button>
                    </td>
                  );
                }

                return <td key={t.name} className="py-4 px-4"></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
