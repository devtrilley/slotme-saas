export default function StatsSummaryCard({ stats }) {
  return (
    <div className="p-5 rounded-2xl
  bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950
  border border-slate-700
  shadow-md
  space-y-2 text-sm">
      <div className="flex justify-between">
        <span>Total Bookings:</span>
        <span className="font-bold">{stats.total_bookings}</span>
      </div>
      <div className="flex justify-between">
        <span>Confirmed Bookings:</span>
        <span className="font-bold">{stats.confirmed}</span>
      </div>
      <div className="flex justify-between">
        <span>Cancelled Bookings:</span>
        <span className="font-bold">{stats.cancelled}</span>
      </div>
      {stats.top_service && (
        <div className="mt-4 text-sm text-left">
          <p className="text-white">Most Booked Service:</p>
          <p className="font-semibold mt-1">"{stats.top_service}"</p>
        </div>
      )}
    </div>
  );
}
