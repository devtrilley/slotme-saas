// src/components/SortButton.jsx

export default function SortButton({ direction, onToggle }) {
  const isAsc = direction === "asc";

  return (
    <button
      className={`btn btn-sm w-full max-w-[10rem] rounded-full font-medium tracking-tight ${
        isAsc
          ? "bg-blue-500/10 text-blue-500 border border-blue-500 hover:bg-blue-500/20"
          : "bg-blue-600 text-white border border-blue-600 hover:bg-blue-700"
      } transition-colors duration-200 ease-in-out`}
      onClick={onToggle}
    >
      {isAsc ? "↑ Oldest First" : "↓ Newest First"}
    </button>
  );
}
