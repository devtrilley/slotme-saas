export default function HoneypotInput({ value, setValue }) {
  return (
    <input
      type="text"
      name="website"
      style={{ display: "none" }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      tabIndex={-1}
      autoComplete="off"
      data-honeypot
    />
  );
}