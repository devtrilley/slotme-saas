import { useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function IconDatePicker({ selected, onChange, ...rest }) {
  const datePickerRef = useRef(null);

  const handleChange = (date) => {
    onChange(date);
    // Close calendar after selection
    setTimeout(() => {
      if (datePickerRef.current) {
        datePickerRef.current.setOpen(false);
      }
    }, 0);
  };

  // 🔥 Prevent keyboard, open calendar manually
  const handleFocus = (e) => {
    e.target.blur(); // Prevent keyboard
    if (datePickerRef.current) {
      datePickerRef.current.setOpen(true);
    }
  };

  const handleClick = () => {
    if (datePickerRef.current) {
      datePickerRef.current.setOpen(true);
    }
  };

  return (
    <div className="relative w-full">
      <style>{`
        /* ✅ Gray out past dates */
        .react-datepicker__day--disabled {
          color: #4B5563 !important;
          background-color: transparent !important;
          cursor: not-allowed !important;
          text-decoration: line-through;
        }

        /* ✅ Make today VERY obvious */
        .react-datepicker__day--today {
          background-color: #8B5CF6 !important;
          color: white !important;
          font-weight: bold !important;
          border-radius: 50% !important;
        }

        /* ✅ Hover effect for selectable dates */
        .react-datepicker__day:not(.react-datepicker__day--disabled):hover {
          background-color: #6D28D9 !important;
          color: white !important;
        }

        /* ✅ Selected date styling */
        .react-datepicker__day--selected {
          background-color: #7C3AED !important;
          color: white !important;
          font-weight: bold !important;
        }

        /* ✅ Make future dates more visible */
        .react-datepicker__day:not(.react-datepicker__day--disabled):not(.react-datepicker__day--selected):not(.react-datepicker__day--today) {
          color: #E5E7EB !important;
        }

        /* 🔥 Hide cursor */
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
        onFocus={handleFocus}  // 🔥 Blur to prevent keyboard, open calendar
        onInputClick={handleClick}  // 🔥 Open calendar on click
        {...rest}
      />
      <span 
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
        onClick={handleClick}  // 🔥 Clicking icon also opens calendar
      >
        📅
      </span>
    </div>
  );
}