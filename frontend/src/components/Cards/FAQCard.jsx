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
      <div className="border border-white/20 bg-white/5 rounded-xl p-4 text-sm text-white text-center shadow-inner">
        <p className="text-white/70 italic">
          This freelancer has not provided any FAQs yet.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-white/20 bg-white/5 rounded-xl p-5 text-white shadow-md backdrop-blur-md">
      <h2 className="text-lg font-bold text-center mb-4 tracking-wide text-white/90">
        FAQs
      </h2>
      <dl className="space-y-4">
        {faq_items.map((faq, idx) => (
          <div key={idx}>
            <dt className="font-semibold text-white text-sm leading-snug">
              {decodeHTMLEntities(faq.question)}
            </dt>
            <dd className="text-sm text-white/70 mt-1 leading-relaxed">
              {decodeHTMLEntities(faq.answer)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
