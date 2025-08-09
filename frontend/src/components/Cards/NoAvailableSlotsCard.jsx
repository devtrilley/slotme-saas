import { DateTime } from "luxon";

export default function NoAvailableSlotsCard({ selectedDate, onRefresh }) {
  const formattedDate = DateTime.fromJSDate(selectedDate).toFormat("MMMM d, yyyy");

  return (
    <div className="text-center border border-white/20 bg-white/5 p-4 rounded-lg text-white shadow-md space-y-3">
      <p className="text-sm text-gray-300">No time slots available for</p>
      <p className="text-xl font-semibold text-white">{formattedDate}</p>

      <p className="text-sm text-gray-400">
        Try picking a different date or refresh to check again.
      </p>

      <div className="flex justify-center gap-2 mt-2">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => window.location.reload()}
        >
          📆 Go to Today
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={onRefresh}
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}