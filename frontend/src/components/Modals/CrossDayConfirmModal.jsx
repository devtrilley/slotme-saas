import BaseModal from "./BaseModal";
import {
  formatSlotTimePartsFromUTC,
  formatSlotTimePartsFromLocal,
  getTimezoneAbbreviation
} from "../../utils/timezoneHelpers";

export default function CrossDayConfirmModal({
  open,
  payload,
  freelancerTimezone,
  onConfirm,
  onClose,
}) {
  if (!open || !payload) return null;

  const { slotStart, slotEnd } = payload;

  // ✅ These are already local times, just extract the abbreviation
  const start = {
    formattedTime: slotStart.time_12h,
    abbreviation: getTimezoneAbbreviation(freelancerTimezone),
  };
  const end = {
    formattedTime: slotEnd.time_12h,
    abbreviation: getTimezoneAbbreviation(freelancerTimezone),
  };

  return (
    <BaseModal
      title="⚠️ Time Range Crosses Into Next Day"
      onClose={onClose}
      dismissible={true}
      showCloseX={true}
      className="max-w-md"
    >
      <div className="space-y-4 text-sm">
        <p>You’ve selected a time range that crosses over into the next day:</p>

        <ul className="list-disc list-inside text-left">
          <li>
            <strong>Start:</strong> {start.formattedTime} on {slotStart.day} (
            {start.abbreviation})
          </li>
          <li>
            <strong>End:</strong> {end.formattedTime} on {slotEnd.day} (
            {end.abbreviation})
          </li>
        </ul>

        <p className="text-yellow-300">
          Are you sure you want to generate these time slots?
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-sm btn-warning"
            onClick={() => onConfirm(payload?.backendPayload)}
          >
            Yes, Continue
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
