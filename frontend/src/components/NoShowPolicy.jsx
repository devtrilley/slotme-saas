export default function NoShowPolicy({ policy }) {
  return (
    <div className="bg-white/5 border border-white/20 rounded-lg p-4 text-sm text-white shadow-sm">
      <strong className="block text-xs text-white/60 uppercase tracking-wide mb-1">
        No-Show Policy
      </strong>
      {policy ? (
        <p className="text-white/90 whitespace-pre-wrap">{policy}</p>
      ) : (
        <p className="text-white/50 italic">
          This freelancer hasn’t specified a no-show or cancellation policy.
        </p>
      )}
    </div>
  );
}