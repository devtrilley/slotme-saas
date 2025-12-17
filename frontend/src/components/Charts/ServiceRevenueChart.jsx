import { useState, useEffect, useRef } from "react";
import { ResponsivePie } from "@nivo/pie";

// ✅ Simple, consistent color palette
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

// 🎯 Assign colors in order per unique service name
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

export default function ServiceRevenueChart({ data }) {
  const [activeId, setActiveId] = useState(null);
  const wrapperRef = useRef(null);

  // ⛔ Reset activeId when clicking outside the chart area
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

  const pieData = data.map(({ service, revenue }) => ({
    id: service,
    value: revenue,
  }));

  return (
    <div
  ref={wrapperRef}
  className="p-5 rounded-2xl
    bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950
    border border-slate-700
    shadow-md
    space-y-4"
>
      <h2 className="text-center text-sm font-semibold">Revenue per Service</h2>

      <div className="w-full h-[220px]">
        <ResponsivePie
          data={pieData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          innerRadius={0}
          padAngle={1}
          cornerRadius={0}
          enableArcLabels={false}
          enableArcLinkLabels={false}
          activeOuterRadiusOffset={10}
          animate={true}
          motionConfig="gentle"
          onClick={({ id }) => setActiveId(id)}
          colors={({ id }) => getColor(id)}
          borderWidth={2}
          borderColor="#fff"
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
              <strong>{datum.id}</strong>: ${datum.value.toFixed(2)}
            </div>
          )}
          legends={[]}
        />
      </div>

      {/* 🧾 Custom Legend */}
      <div className="pt-3 space-y-1 text-sm">
        {[...data]
          .sort((a, b) => b.revenue - a.revenue)
          .map(({ service, revenue }) => (
            <div
              key={service}
              onClick={() => setActiveId(service)}
              className={`flex items-center gap-2 cursor-pointer ${
                activeId === service ? "text-white font-bold" : "text-gray-300"
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: getColor(service) }}
              />
              <span className="truncate">{service}</span>
              <span className="ml-auto font-semibold">
                ${revenue.toFixed(2)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
