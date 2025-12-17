export default function NoShowPolicy({ policy }) {
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-md border border-slate-700 hover:shadow-lg hover:-translate-y-[1px] transition-all duration-150">
      <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide text-center flex items-center justify-center gap-2">
        <span className="text-red-400">⚠️</span>
        No-Show Policy
      </h2>
      {policy ? (
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
          {policy}
        </p>
      ) : (
        <p className="text-gray-400 italic text-sm text-center">
          This freelancer hasn't specified a no-show or cancellation policy.
        </p>
      )}
    </div>
  );
}
