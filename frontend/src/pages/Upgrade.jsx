export default function Upgrade() {
  const tiers = [
    {
      name: "FREE",
      bg: "bg-slate-800",
      text: "text-white",
      features: [
        { label: "Unlimited bookings", value: true },
        { label: "Custom branding", value: false },
        { label: "Priority support", value: false },
        { label: "Verified badge", value: false },
      ],
    },
    {
      name: "PRO",
      bg: "bg-pink-600",
      text: "text-white",
      features: [
        { label: "Unlimited bookings", value: true },
        { label: "Custom branding", value: true },
        { label: "Priority support", value: false },
        { label: "Verified badge", value: true },
      ],
    },
    {
      name: "ELITE",
      bg: "bg-indigo-600",
      text: "text-white",
      features: [
        { label: "Unlimited bookings", value: true },
        { label: "Custom branding", value: true },
        { label: "Priority support", value: true },
        { label: "Verified badge", value: true },
      ],
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      <h1 className="text-4xl font-bold text-center">
        Upgrade Your <span className="text-indigo-400">SlotMe</span> Experience
      </h1>

      {/* Cards: visible on all screens, layout shifts on md+ */}
      <div className="flex flex-col md:flex-row md:justify-between gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-2xl shadow-lg p-6 flex-1 text-center ${tier.bg} ${tier.text}`}
          >
            <h2 className="text-2xl font-extrabold mb-4">{tier.name}</h2>
            <ul className="space-y-2 text-left text-lg">
              {tier.features.map((feature, idx) => (
                <li key={idx}>
                  • {feature.label}
                  <span className="ml-1">{feature.value ? "✅" : "❌"}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Table: hidden on mobile, shown on md+ */}
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
