// src/components/FilterButton.jsx

export default function FilterButton({
  label = "Filter:",
  options = [],
  value,
  onChange,
}) {
  const getLabel = (option) => {
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
      default:
        return option;
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
