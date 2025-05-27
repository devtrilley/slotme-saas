export default function Upgrade() {
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      <h1 className="text-4xl font-bold text-center">
        Upgrade Your <span className="text-indigo-400">SlotMe</span> Experience
      </h1>

      {/* Cards: visible only on mobile */}
      <div className="flex flex-col md:hidden gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-2xl shadow-lg p-6 flex-1 text-center ${tier.bg} ${tier.text}`}
          >
            <h2 className="text-2xl font-extrabold mb-4">{tier.name}</h2>
            <ul className="space-y-2 text-left text-lg">
              {[...tier.features]
                .sort((a, b) => (a.value === b.value ? 0 : a.value ? -1 : 1))
                .map((feature, idx) => (
                  <li key={idx}>
                    • {feature.label}
                    <span className="ml-1">{feature.value ? "✅" : "❌"}</span>
                  </li>
                ))
              }
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
          </tbody>
        </table>
      </div>
    </div>
  );
}