import { useRef, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function IconDatePicker({
  selected,
  onChange,
  availableDates = [],
  ...rest
}) {
  const datePickerRef = useRef(null);

  const handleChange = (date) => {
    onChange(date);
    setTimeout(() => {
      if (datePickerRef.current) {
        datePickerRef.current.setOpen(false);
      }
    }, 0);
  };

  const handleFocus = (e) => {
    e.target.blur();
    if (datePickerRef.current) {
      datePickerRef.current.setOpen(true);
    }
  };

  const handleClick = () => {
    if (datePickerRef.current) {
      datePickerRef.current.setOpen(true);
    }
  };

  // 🔥 FIX: Parse YYYY-MM-DD as local date to avoid timezone bugs
  const availableSet = useMemo(() => {
    return new Set(
      availableDates.map((dateStr) => {
        // Parse YYYY-MM-DD as local date components (not UTC)
        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day).setHours(0, 0, 0, 0);
      })
    );
  }, [availableDates]);

  return (
    <div className="relative w-full">
      <style>{`
        .react-datepicker__day--disabled {
          color: #4B5563 !important;
          background-color: transparent !important;
          cursor: not-allowed !important;
          text-decoration: line-through;
        }

        /* Green text for dates with slots */
        .react-datepicker__day--has-slots {
          color: #10B981 !important;
          font-weight: bold !important;
        }

        /* Today marker - purple circle */
        .react-datepicker__day--today {
          background-color: #8B5CF6 !important;
          color: white !important;
          font-weight: bold !important;
          border-radius: 50% !important;
        }

        /* 🔥 TODAY + HAS SLOTS = Keep purple circle, GREEN text */
        .react-datepicker__day--today.react-datepicker__day--has-slots {
          color: #10B981 !important;
        }

        /* Selected marker - purple background */
        .react-datepicker__day--selected {
          background-color: #7C3AED !important;
          color: white !important;
          font-weight: bold !important;
          border-radius: 6px !important;
        }

        /* 🔥 SELECTED + HAS SLOTS = Keep purple background, GREEN text */
        .react-datepicker__day--selected.react-datepicker__day--has-slots {
          color: #10B981 !important;
        }

        /* Hover states */
        .react-datepicker__day:not(.react-datepicker__day--disabled):hover {
          background-color: #6D28D9 !important;
          color: white !important;
        }

        .react-datepicker__day--has-slots:hover {
          background-color: #059669 !important;
          color: white !important;
        }

        /* Regular dates (not disabled, selected, today, or has-slots) */
        .react-datepicker__day:not(.react-datepicker__day--disabled):not(.react-datepicker__day--selected):not(.react-datepicker__day--today):not(.react-datepicker__day--has-slots) {
          color: #E5E7EB !important;
        }

        .date-picker-input {
          caret-color: transparent !important;
          cursor: pointer !important;
        }
      `}</style>

      <DatePicker
        ref={datePickerRef}
        selected={selected}
        onChange={handleChange}
        className="input input-bordered w-full pl-10 date-picker-input"
        dateFormat="MMMM d, yyyy"
        placeholderText="Choose a date"
        wrapperClassName="w-full"
        minDate={new Date()}
        onFocus={handleFocus}
        onInputClick={handleClick}
        portalId="root"
        dayClassName={(date) => {
          const dayLocal = new Date(date).setHours(0, 0, 0, 0);
          const today = new Date().setHours(0, 0, 0, 0);

          if (dayLocal < today) {
            return undefined;
          }

          const hasSlots = availableSet.has(dayLocal);

          // 🔥 DEBUG: Log Nov 29 specifically
          if (date.getDate() === 29 && date.getMonth() === 10) {
            console.log("📅 Nov 29 check:", {
              dayLocal,
              availableSet: Array.from(availableSet),
              hasSlots,
              availableDates,
            });
          }

          return hasSlots ? "react-datepicker__day--has-slots" : undefined;
        }}
        {...rest}
      />

      <span
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
        onClick={handleClick}
      >
        📅
      </span>
    </div>
  );
}
