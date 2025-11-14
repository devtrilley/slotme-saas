import { useNavigate, useSearchParams } from "react-router-dom";

export default function Expired() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const freelancerSlug =
    searchParams.get("slug") || searchParams.get("freelancer_id");
  const reason = searchParams.get("reason"); // 'time_passed' or null

  const handleBookAgain = () => {
    if (freelancerSlug) {
      navigate(`/${freelancerSlug}`);
    } else {
      navigate("/");
    }
  };

  // Different content based on reason
  const isTimePassed = reason === "time_passed";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base-100">
      <div className="max-w-md w-full bg-base-200 rounded-lg shadow-xl p-8 text-center space-y-6">
        {/* Icon */}
        <div className="text-7xl">{isTimePassed ? "⏰" : "⏱️"}</div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-yellow-400">
          {isTimePassed ? "Time Slot Has Passed" : "Confirmation Link Expired"}
        </h1>

        {/* Explanation */}
        <div className="text-gray-300 text-sm space-y-3">
          {isTimePassed ? (
            <>
              <p>
                This time slot has already passed and can no longer be
                confirmed.
              </p>
              <p>
                Please select a future time slot when booking your appointment.
              </p>
            </>
          ) : (
            <>
              <p>
                This confirmation link has expired. Links are only valid for{" "}
                <strong className="text-white">15 minutes</strong> after
                booking.
              </p>
              <p>
                Don't worry! You can book again and confirm quickly this time.
              </p>
            </>
          )}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleBookAgain}
          className="btn btn-primary w-full mt-4"
        >
          📅 Book Again
        </button>
      </div>
    </div>
  );
}