import { useContext, useState, useRef } from "react";
import { useFreelancer } from "../../context/FreelancerContext";
import { showToast } from "../../utils/toast";
import BaseModal from "./BaseModal";

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

  const { freelancerDetails } = useContext(useFreelancer);
  const tier = freelancerDetails?.tier;

  const [showAnswers, setShowAnswers] = useState(false);
  const answerRef = useRef(null);

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
          <strong>Date:</strong> {slot_day}
        </p>
        <p>
          <strong>Time:</strong> {slot_time} ({freelancer_timezone})
        </p>
        <p>
          <strong>Service:</strong> {service || "N/A"}
        </p>
        <p>
          <strong>Duration:</strong> {service_duration_minutes || "?"} min
        </p>

        {Object.keys(custom_responses).length > 0 && (
          <div className="pt-3 border-t border-base-content/10">
            <h4 className="font-semibold mb-2">
              Customer's Answers to Custom Questions
            </h4>

            <button
              onClick={() => {
                if (["pro", "elite"].includes(tier)) {
                  setShowAnswers((prev) => !prev);
                } else {
                  // animate shake
                  if (answerRef.current) {
                    answerRef.current.classList.add("animate-shake");
                    setTimeout(() => {
                      answerRef.current.classList.remove("animate-shake");
                    }, 600);
                  }

                  showToast(
                    <span>
                      Custom Questions is a PRO/ELITE feature.{" "}
                      <a
                        href={`/upgrade#elite?need=pro`}
                        className="underline font-medium"
                      >
                        Upgrade →
                      </a>
                    </span>,
                    "error"
                  );
                }
              }}
              className="btn btn-sm btn-outline w-full"
            >
              {showAnswers ? "Hide" : "View"} Customer Answers
            </button>

            <div
              ref={answerRef}
              className={`mt-2 transition-all duration-300 ${
                showAnswers ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
              } overflow-hidden`}
            >
              <ul className="space-y-2 text-sm mt-2">
                {Object.entries(custom_responses).map(([question, answer]) => (
                  <li
                    key={question}
                    className="border border-base-content/10 px-3 py-2 rounded-md"
                  >
                    <p className="text-base-content/70 mb-1">
                      <span className="font-semibold">Q:</span>{" "}
                      <span className="italic">{question}</span>
                    </p>
                    <p>
                      <span className="font-semibold">A:</span> {answer || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

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
