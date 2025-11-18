import { DateTime } from "luxon";

export default function NoAvailableSlotsCard({ selectedDate, hasSlotsForDay, onRefresh }) {
  const formattedDate = DateTime.fromJSDate(selectedDate).toFormat("MMMM d, yyyy");

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
    <div className="text-center border border-white/20 bg-white/5 p-4 rounded-lg text-white shadow-md space-y-3">
      <p className="text-sm text-gray-300">No time slots available for</p>
      <p className="text-xl font-semibold text-white">{formattedDate}</p>

      <p className="text-sm text-gray-400">{getMessage()}</p>

      <div className="flex justify-center gap-2 mt-2">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => window.location.reload()}
        >
          📆 Go to Today
        </button>
        <button className="btn btn-sm btn-outline" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}