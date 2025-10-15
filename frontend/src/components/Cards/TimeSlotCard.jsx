import React from "react";
import {
  isSlotInPast,
  formatSlotTimeParts,
  formatSlotDate,
} from "../../utils/timezoneHelpers";

export default function TimeSlotCard({
  slot,
  onClick,
  showButton = true,
  centered = false,
  freelancerTimezone,
}) {
  const isPast = isSlotInPast(slot, freelancerTimezone);

  const bgColor =
    slot.is_booked || slot.is_inherited_block
      ? "border-primary bg-[rgba(139,92,246,0.10)]"
      : isPast
      ? "border-gray-400 bg-[rgba(107,114,128,0.2)]"
      : "border-green-300 bg-[rgba(34,197,94,0.1)]";

  return (
    <div
      className={`p-4 rounded-xl shadow-sm border transition hover:shadow-md ${bgColor} ${
        centered ? "text-center items-center" : ""
      }`}
    >
      <p className={`${centered ? "text-sm" : "text-xs"} text-gray-400 mb-1`}>
        {formatSlotDate(slot, freelancerTimezone)}
      </p>
      <p
        className={`${
          centered ? "text-xl justify-center" : "text-lg"
        } font-semibold flex items-center gap-1`}
      >
        {(() => {
          const { formattedTime, abbreviation } = formatSlotTimeParts(
            slot,
            freelancerTimezone
          );
          return (
            <>
              <span>{formattedTime}</span>
              <span className="text-xs text-gray-400">{abbreviation}</span>
            </>
          );
        })()}
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
        <p className={`${centered ? "text-base" : "text-sm"} text-green-400`}>
          Available
        </p>
      )}

      {/* 🔥 NEW: Show both Book and Delete buttons for available slots */}
      {showButton && !slot.is_booked && !slot.is_inherited_block && !isPast && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(slot);
            }}
            className="btn btn-primary btn-sm"
          >
            Manually Book
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick({ ...slot, _deleteAction: true });
            }}
            className="btn btn-error btn-sm"
          >
            Delete
          </button>
        </div>
      )}

      {/* 🔥 NEW: Show delete button for passed/booked slots */}
      {showButton && (slot.is_booked || slot.is_inherited_block || isPast) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick({ ...slot, _deleteAction: true });
          }}
          className="btn btn-sm btn-error mt-2"
        >
          🗑️ Delete Slot
        </button>
      )}
    </div>
  );
}
