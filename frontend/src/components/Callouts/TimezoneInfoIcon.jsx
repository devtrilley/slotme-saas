import React, { useState } from "react";
import { getTimezoneAbbreviation } from "../../utils/timezoneHelpers";

export default function TimezoneInfoIcon({ timezone }) {
  const [showTip, setShowTip] = useState(false);
  const abbr = getTimezoneAbbreviation(timezone);

  return (
    <div className="relative inline-block text-left">
      <span
        onClick={(e) => {
          e.stopPropagation(); // Prevent slot selection
          setShowTip(!showTip);
        }}
        className="ml-1 text-xs text-gray-400 hover:text-white cursor-pointer"
        role="button"
        aria-label="More info about timezones"
        title="Info"
      >
        ℹ️
      </span>

      {showTip && (
        <div className="absolute z-50 mt-2 w-56 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 border border-gray-600 right-0">
          <p className="text-sm">
            This time is shown in <strong>your local timezone</strong> ({abbr}).
          </p>
          <button
            onClick={() => setShowTip(false)}
            className="mt-2 text-xs underline text-purple-300"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
