import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function IconDatePicker({ selected, onChange, ...rest }) {
  return (
    <div className="relative w-full">
      <DatePicker
        selected={selected}
        onChange={onChange}
        className="input input-bordered w-full pl-10"
        dateFormat="MMMM d, yyyy"
        placeholderText="Choose a date"
        wrapperClassName="w-full"
        {...rest}
      />
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
        📅
      </span>
    </div>
  );
}