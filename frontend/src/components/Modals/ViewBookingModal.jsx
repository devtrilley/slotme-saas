import { useContext, useState, useRef } from "react";
import { useFreelancer } from "../../context/FreelancerContext";
import { showToast } from "../../utils/toast";
import BaseModal from "./BaseModal";
import {
  formatSlotTimePartsFromUTC,
  formatSlotTimePartsFromLocal,
} from "../../utils/timezoneHelpers";

export default function ViewBookingModal({ appointment, onClose, onCancel }) {
  if (!appointment) return null;

  const {
    name,
    email,
    slot_day,
    slot_time,
    freelancer_timezone,
    service,
    service_duration_minutes,
    status,
    custom_responses = {},
  } = appointment;

  const context = useContext(useFreelancer);
  const freelancerDetails = context?.freelancerDetails;
  const tier = freelancerDetails?.tier;

  if (!freelancerDetails) {
    console.warn("⚠️ freelancerDetails not available. Showing limited modal.");
  }

  const [showAnswers, setShowAnswers] = useState(false);
  const answerRef = useRef(null);

  const customQuestionsEnabled = freelancerDetails?.custom_questions_enabled;

  // 🔥 Status color mapping
  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "text-green-400";
      case "pending":
        return "text-yellow-400";
      case "cancelled":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <BaseModal
      title="Booking Details"
      open={!!appointment}
      onClose={onClose}
      showCloseX={true}
    >
      <div className="space-y-3">
        <p>
          <strong>Name:</strong> {name || "Unknown"}
        </p>
        <p>
          <strong>Email:</strong> {email || "N/A"}
        </p>
        <p>
          <strong>Phone:</strong> {appointment.phone || "N/A"}
        </p>
        <p>
          <strong>Status:</strong>{" "}
          <span className={`font-semibold ${getStatusColor(status)}`}>
            {status
              ? status.charAt(0).toUpperCase() + status.slice(1)
              : "Unknown"}
          </span>
        </p>
        <p>
          <strong>Date:</strong>{" "}
          {new Date(slot_day + "T00:00:00").toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit",
          })}
        </p>
        <p>
          <strong>Time:</strong> {slot_time}
          <span className="ml-1 text-xs text-gray-400">
            {appointment.timezone_abbr || "EST"}
          </span>
        </p>
        <p>
          <strong>Service:</strong> {service || "N/A"}
        </p>
        <p>
          <strong>Duration:</strong> {service_duration_minutes || "?"} min
        </p>

        <div className="pt-3 border-t border-base-content/10">
          <h4 className="font-semibold mb-2">Customer Q&A</h4>

          {Object.keys(custom_responses).length === 0 ? (
            <p className="text-sm italic text-base-content/60">
              No custom answers.
            </p>
          ) : (
            <>
              <button
                onClick={() => setShowAnswers((prev) => !prev)}
                className="btn btn-sm btn-outline w-full"
              >
                {showAnswers ? "Hide" : "View"} Customer Answers
              </button>

              <div
                ref={answerRef}
                className={`mt-2 transition-all duration-300 ${
                  showAnswers
                    ? "max-h-[500px] opacity-100"
                    : "max-h-0 opacity-0"
                } overflow-hidden`}
              >
                <ul className="space-y-2 text-sm mt-2">
                  {Object.entries(custom_responses).map(
                    ([question, answer]) => (
                      <li
                        key={question}
                        className="border border-base-content/10 px-3 py-2 rounded-md"
                      >
                        <p className="text-base-content/70 mb-1">
                          <span className="font-semibold">Q:</span>{" "}
                          <span className="italic">{question}</span>
                        </p>
                        <p>
                          <span className="font-semibold">A:</span>{" "}
                          {answer || "—"}
                        </p>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        {status === "confirmed" && (
          <button
            className="btn btn-error w-full"
            onClick={() => {
              onCancel(appointment.id);
              onClose();
            }}
          >
            ❌ Cancel Appointment
          </button>
        )}

        <button className="btn btn-outline w-full" onClick={onClose}>
          Close
        </button>
      </div>
    </BaseModal>
  );
}
