// Helper to decode HTML entities stored in the database
const decodeHTMLEntities = (text) => {
  if (!text) return text;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
};
export default function FAQCard({ faq_items }) {
  if (!faq_items || faq_items.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-md border border-slate-700 text-center">
        <p className="text-gray-400 italic text-sm">
          This freelancer has not provided any FAQs yet.
        </p>
      </div>
    );
  }
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-md border border-slate-700 hover:shadow-lg hover:-translate-y-[1px] transition-all duration-150">
      <h2 className="text-lg font-bold text-center mb-5 tracking-wide text-white flex items-center justify-center gap-2">
        FAQs❓
      </h2>
      <dl className="space-y-4">
        {faq_items.map((faq, idx) => (
          <div
            key={idx}
            className="border-b border-slate-700/50 last:border-0 pb-3 last:pb-0"
          >
            <dt className="font-semibold text-white text-sm leading-snug mb-1.5">
              {decodeHTMLEntities(faq.question)}
            </dt>
            <dd className="text-sm text-gray-400 leading-relaxed">
              {decodeHTMLEntities(faq.answer)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
