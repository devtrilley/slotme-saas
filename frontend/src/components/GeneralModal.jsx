export default function GeneralModal({
  title,
  body,
  onClose,
  confirmText = "Okay",
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-base-200 p-6 rounded-xl shadow-xl w-11/12 max-w-sm max-h-[90vh] overflow-y-auto relative mx-4 my-10">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-white text-2xl"
        >
          &times;
        </button>

        <h2 className="text-xl font-bold text-center text-white">{title}</h2>
        <p className="text-gray-300 text-center mt-2">{body}</p>

        <button className="btn btn-primary w-full mt-6" onClick={onClose}>
          {confirmText}
        </button>
      </div>
    </div>
  );
}
