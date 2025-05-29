export default function FAQCard({ text }) {
  if (!text?.trim()) {
    return (
      <div className="border border-white/20 bg-white/5 rounded-lg p-4 text-sm text-white text-center">
        <p className="text-white/70 italic">
          This freelancer has not provided any FAQ or additional information.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-white/20 bg-white/5 rounded-lg p-4 text-sm text-white whitespace-pre-wrap">
      <h2 className="text-lg font-semibold text-white text-center mb-2">FAQs</h2>
      <p>{text}</p>
    </div>
  );
}