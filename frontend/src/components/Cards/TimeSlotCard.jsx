import React from "react";

export default function TimeSlotCard({ slot, onClick }) {
  const isPast = new Date(`${slot.day} ${slot.time}`) < new Date();

  const bgColor =
    slot.is_booked || slot.is_inherited_block
      ? "border-primary bg-[rgba(139,92,246,0.10)]"
      : isPast
      ? "border-gray-400 bg-[rgba(107,114,128,0.2)]"
      : "border-green-300 bg-[rgba(34,197,94,0.1)]";

  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      className={`p-4 rounded-xl shadow-sm border transition hover:shadow-md ${bgColor}`}
    >
      <p className="text-xs text-gray-400 mb-1">{formatDate(slot.day)}</p>
      <p className="text-lg font-semibold flex items-center gap-1">
        {slot.time}
        <span className="text-xs text-gray-400">UTC</span>
      </p>

      {slot.is_booked || slot.is_inherited_block ? (
        slot.appointment?.name &&
        slot.appointment?.email &&
        !slot.is_inherited_block ? (
          <>
            <p className="text-sm text-primary font-medium">Booked by:</p>
            <button
              onClick={() => onClick(slot)}
              className="underline text-primary text-sm text-left"
            >
              {slot.appointment.name} ({slot.appointment.email})
            </button>
          </>
        ) : (
          <p className="text-sm text-primary italic">
            Booked (part of earlier appointment)
          </p>
        )
      ) : isPast ? (
        <p className="text-sm text-gray-400">⏱️ Passed</p>
      ) : (
        <p className="text-sm text-green-400">Available</p>
      )}

      {!slot.is_booked && !slot.is_inherited_block && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick(slot); // pass full slot object to handler
          }}
          className="btn btn-sm btn-primary mt-2"
        >
          Manually Book
        </button>
      )}
    </div>
  );
}
