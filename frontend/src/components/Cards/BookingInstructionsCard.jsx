export default function BookingInstructionsCard({ instructions }) {
  if (!instructions) return null;
  return (
    <div className="border border-white/20 bg-white/5 rounded-lg p-4 text-left text-sm text-white">
      <h2 className="text-sm font-semibold text-white mb-2 uppercase tracking-wide text-center">
        Booking Instructions
      </h2>
      <p className="text-white/80">{instructions}</p>
    </div>
  );
}
