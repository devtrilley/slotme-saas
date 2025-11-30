// src/components/FilterButton.jsx
export default function FilterButton({
  label = "Filter:",
  options = [],
  value,
  onChange,
}) {
  const getLabel = (option) => {
    // 🔥 NEW: Timezone mapping (add this at the top)
    const timezoneMap = {
      "America/New_York": "🕐 Eastern (EST)",
      "America/Chicago": "🕑 Central (CST)",
      "America/Denver": "🕒 Mountain (MST)",
      "America/Phoenix": "🕒 Mountain (No DST)",
      "America/Los_Angeles": "🕓 Pacific (PST)",
      "America/Anchorage": "🕔 Alaska (AKST)",
      "America/Adak": "🕕 Hawaii-Aleutian (HST)",
    };

    // Check if it's a timezone first
    if (timezoneMap[option]) {
      return timezoneMap[option];
    }

    // Then check status filters
    switch (option) {
      case "all":
        return "📋 All";
      case "available":
        return "✅ Available";
      case "booked":
        return "📌 Booked";
      case "passed":
        return "⏱️ Passed";
      case "free":
        return "🟢 Free";
      case "pro":
        return "🔵 Pro";
      case "elite":
        return "🟣 Elite";
      case "paid":
        return "💰 Paid";
      case "confirmed":
        return "✅ Confirmed";
      case "pending":
        return "⚠️ Pending";
      case "cancelled":
        return "✖️ Cancelled";
      default:
        // Capitalize first letter for any other options (like service names)
        return option.charAt(0).toUpperCase() + option.slice(1);
    }
  };

  const getNext = (current) => {
    const index = options.indexOf(current);
    return options[(index + 1) % options.length];
  };

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <span className="text-sm text-gray-400">{label}</span>
      <button
        className="btn btn-sm w-full max-w-[10rem] transition-colors duration-200 ease-in-out bg-blue-500/10 text-blue-500 border border-blue-500 hover:bg-blue-500/20"
        onClick={() => onChange(getNext(value))}
      >
        {getLabel(value)}
      </button>
    </div>
  );
}