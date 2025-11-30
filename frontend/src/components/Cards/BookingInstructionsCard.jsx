export default function BookingInstructionsCard({ instructions }) {
  // Handle empty, undefined, or empty array
  if (!instructions || (Array.isArray(instructions) && instructions.length === 0)) {
    return null;
  }

  // Backwards compatibility: if it's still a string, convert to array
  const instructionList = Array.isArray(instructions) 
    ? instructions 
    : [instructions];

  // Filter out any empty strings
  const cleanList = instructionList.filter(i => i && i.trim());
  
  if (cleanList.length === 0) return null;

  return (
    <div className="border border-white/20 bg-white/5 rounded-lg p-4 text-left text-sm text-white">
      <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide text-center">
        Booking Instructions
      </h2>
      <ul className="space-y-2 text-white/90">
        {cleanList.map((instruction, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span className="flex-1">{instruction}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}