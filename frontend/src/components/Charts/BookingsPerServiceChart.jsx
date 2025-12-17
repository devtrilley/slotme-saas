import { ResponsivePie } from "@nivo/pie";
import { useState, useRef, useEffect } from "react";

// ✅ Simple dynamic color palette — consistent and clean
const colorPalette = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#6366F1",
  "#EC4899",
  "#8B5CF6",
  "#22D3EE",
  "#EAB308",
];

// 🎯 Dynamic color assignment based on service ID
const getColor = (() => {
  const assigned = new Map();
  let i = 0;

  return (id) => {
    if (!assigned.has(id)) {
      assigned.set(id, colorPalette[i % colorPalette.length]);
      i++;
    }
    return assigned.get(id);
  };
})();

export default function BookingsPerServiceChart({ data }) {
  const [activeId, setActiveId] = useState(null);
  const wrapperRef = useRef(null);

  // ⛔ Clear selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setActiveId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const chartData = data.map(({ id, value }) => ({ id, value }));

  return (
    <div
  ref={wrapperRef}
  className="p-5 rounded-2xl
    bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950
    border border-slate-700
    shadow-md
    space-y-4"
>
      <h2 className="text-center text-sm font-semibold">
        Bookings per Service
      </h2>

      <div className="w-full h-[220px]">
        <ResponsivePie
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          innerRadius={0.5}
          padAngle={1}
          cornerRadius={4}
          activeOuterRadiusOffset={10}
          enableArcLabels={true}
          arcLabel={(d) => d.value}
          arcLabelsTextColor="#fff"
          enableArcLinkLabels={false}
          onClick={({ id }) => setActiveId(id)}
          colors={({ id }) => getColor(id)}
          borderWidth={1}
          borderColor={{ from: "color", modifiers: [["darker", 0.3]] }}
          tooltip={({ datum }) => (
            <div
              style={{
                background: "#fff",
                padding: "6px 12px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                color: "#111",
              }}
            >
              <strong>{datum.id}</strong>: {datum.value}
            </div>
          )}
          legends={[]}
        />
      </div>

      {/* 🧾 Custom Legend */}
      <div className="pt-3 space-y-1 text-sm">
        {[...data]
          .sort((a, b) => b.value - a.value)
          .map(({ id, value }) => (
            <div
              key={id}
              onClick={() => setActiveId(id)}
              className={`flex items-center gap-2 cursor-pointer ${
                activeId === id ? "text-white font-bold" : "text-gray-300"
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: getColor(id) }}
              />
              <span className="truncate">{id}</span>
              <span className="ml-auto font-semibold">{value}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
