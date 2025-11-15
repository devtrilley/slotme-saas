import { useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function IconDatePicker({ selected, onChange, ...rest }) {
  const datePickerRef = useRef(null);

  const handleChange = (date) => {
    onChange(date);
    // Force blur to close calendar and remove focus
    setTimeout(() => {
      if (datePickerRef.current) {
        datePickerRef.current.setOpen(false);
        const input = datePickerRef.current.input;
        if (input) {
          input.blur();
        }
      }
    }, 0);
  };

  return (
    <div className="relative w-full">
      <DatePicker
        ref={datePickerRef}
        selected={selected}
        onChange={handleChange}
        className="input input-bordered w-full pl-10"
        dateFormat="MMMM d, yyyy"
        placeholderText="Choose a date"
        wrapperClassName="w-full"
        popperClassName="date-picker-popper"
        popperPlacement="bottom-start"
        minDate={new Date()}
        {...rest}
      />
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
        📅
      </span>
    </div>
  );
}