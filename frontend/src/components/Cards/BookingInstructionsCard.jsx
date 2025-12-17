export default function BookingInstructionsCard({ instructions }) {
  if (
    !instructions ||
    (Array.isArray(instructions) && instructions.length === 0)
  ) {
    return null;
  }
  const instructionList = Array.isArray(instructions)
    ? instructions
    : [instructions];
  const cleanList = instructionList.filter((i) => i && i.trim());
  if (cleanList.length === 0) return null;
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-md border border-slate-700 hover:shadow-lg hover:-translate-y-[1px] transition-all duration-150">
      <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide text-center flex items-center justify-center gap-2">
        <span className="text-blue-400">📋</span>
        Booking Instructions
      </h2>
      <ul className="space-y-2.5 text-sm">
        {cleanList.map((instruction, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="text-primary text-lg leading-none">•</span>
            <span className="flex-1 text-gray-300 leading-relaxed">{instruction}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
