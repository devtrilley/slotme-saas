import { DateTime } from "luxon";

export default function NoAvailableSlotsCard({
  selectedDate,
  hasSlotsForDay,
  onRefresh,
}) {
  const formattedDate =
    DateTime.fromJSDate(selectedDate).toFormat("MMMM d, yyyy");

  // ✅ Check if selected date is today
  const isToday = DateTime.fromJSDate(selectedDate)
    .startOf("day")
    .equals(DateTime.now().startOf("day"));

  // ✅ Determine message based on context
  const getMessage = () => {
    if (isToday && hasSlotsForDay) {
      return "All time slots for today have passed. Please select a future date.";
    }
    if (!hasSlotsForDay) {
      return "This freelancer hasn't created time slots for this date yet. Try another date or check back later.";
    }
    return "Try picking a different date or refresh to check again.";
  };

  return (
    <div className="text-center text-white space-y-4 py-8">
      <p className="text-sm text-rose-400">No time slots available for</p>
      <p className="text-2xl font-bold text-white">{formattedDate}</p>
      <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
        {getMessage()}
      </p>
      <div className="flex justify-center gap-3 mt-6">
        <button
          className="btn btn-sm btn-outline border-white/30 hover:bg-white/10 text-white"
          onClick={() => window.location.reload()}
        >
          📆 Go to Today
        </button>
        <button
          className="btn btn-sm btn-outline border-white/30 hover:bg-white/10 text-white"
          onClick={onRefresh}
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}
