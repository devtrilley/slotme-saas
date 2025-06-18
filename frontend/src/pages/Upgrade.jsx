import { useNavigate } from "react-router-dom";
import TierStatusCard from "../components/TierStatusCard";
import { useEffect, useState } from "react";
import { API_BASE } from "../utils/constants";
import { showToast } from "../utils/toast";

import { useFreelancer } from "../context/FreelancerContext";

export default function Upgrade() {
  const { freelancer, setFreelancer } = useFreelancer();

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

  const branding = { tier: (freelancer?.tier || "free").toLowerCase() };

  async function upgrade(plan) {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        alert("Please log in to upgrade your plan.");
        return;
      }

      const res = await fetch(`${API_BASE}/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          success_url: `${window.location.origin}/upgrade-success`,
        }),
      });

      const data = await res.json();
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
      <h1 className="text-4xl font-bold text-center">
        Upgrade Your <span className="text-indigo-400">SlotMe</span> Experience
      </h1>

      <TierStatusCard tier={freelancer?.tier || "free"} />

      {/* Cards: visible only on mobile */}
      <div className="flex flex-col md:hidden gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            id={tier.name.includes("ELITE") ? "elite-tier" : undefined} // ✅ Add this line
            className={`rounded-2xl shadow-lg p-6 flex-1 text-center ${
              tier.bg
            } ${tier.text} ${
              branding.tier &&
              branding.tier === tier.name.split(" ")[0].toLowerCase()
                ? "ring-2 ring-yellow-400 ring-offset-2"
                : ""
            }`}
          >
            <h2 className="text-2xl font-extrabold mb-4">{tier.name}</h2>
            {tier.name.includes("PRO") &&
              branding.tier !== "pro" &&
              branding.tier !== "elite" && (
                <button
                  onClick={() => upgrade("pro")}
                  className="bg-white text-black font-semibold py-2 px-4 rounded-full mb-2"
                >
                  Upgrade to PRO
                </button>
              )}

            {tier.name.includes("ELITE") && branding.tier !== "elite" && (
              <button
                onClick={() => upgrade("elite")}
                className="bg-white text-black font-semibold py-2 px-4 rounded-full mb-2"
              >
                Upgrade to ELITE
              </button>
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
              {tiers.map((t) => (
                <td key={t.name} className="py-4 px-4">
                  {t.name.includes("PRO") &&
                    branding.tier !== "pro" &&
                    branding.tier !== "elite" && (
                      <button
                        onClick={() => upgrade("pro")}
                        className="bg-white text-black font-semibold py-2 px-4 rounded-full"
                      >
                        Upgrade
                      </button>
                    )}

                  {t.name.includes("ELITE") && branding.tier !== "elite" && (
                    <button
                      onClick={() => upgrade("elite")}
                      className="bg-white text-black font-semibold py-2 px-4 rounded-full"
                    >
                      Upgrade
                    </button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
