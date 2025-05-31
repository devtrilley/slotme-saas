import { ResponsivePie } from "@nivo/pie";
import { useState } from "react";

const colorMap = {
  "Happy Ending Herbal Rubdown": "#EF4444",
  "O'Breezy Prezidential Fade": "#22C55E",
  "Thai Five-Hand Combo": "#F59E0B",
};

export default function BookingsPerServiceChart({ data }) {
  const [activeId, setActiveId] = useState(null);

  const chartData = data.map(({ id, value }) => ({ id, value }));

  return (
    <div className="bg-white/5 rounded-lg p-4 shadow space-y-4">
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
          onClick={({ id }) => setActiveId((prev) => (prev === id ? null : id))}
          colors={({ id }) => colorMap[id] || "#4B5563"}  // Tailwind's gray-600
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

      {/* Custom Legend */}
      <div className="pt-3 space-y-1 text-sm">
        {[...data]
          .sort((a, b) => b.value - a.value)
          .map(({ id, value }) => (
            <div
              key={id}
              onClick={() => setActiveId((prev) => (prev === id ? null : id))}
              className={`flex items-center gap-2 cursor-pointer ${
                activeId === id ? "text-white font-bold" : "text-gray-300"
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: colorMap[id] || "#999" }}
              />
              <span className="truncate">{id}</span>
              <span className="ml-auto font-semibold">{value}</span>
            </div>
          ))}
      </div>
    </div>
  );
}