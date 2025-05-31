import { useState } from "react";
import { ResponsivePie } from "@nivo/pie";

const colorMap = {
  "Happy Ending Herbal Rubdown": "#EF4444",
  "O'Breezy Prezidential Fade": "#22C55E",
  "Thai Five-Hand Combo": "#F59E0B",
};

export default function ServiceRevenueChart({ data }) {
  const [activeId, setActiveId] = useState(null);

  const pieData = data.map(({ service, revenue }) => ({
    id: service,
    value: revenue,
  }));

  return (
    <div className="bg-white/5 rounded-lg p-4 shadow space-y-4">
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
          onClick={({ id }) =>
            setActiveId((prev) => (prev === id ? null : id))
          }
          colors={({ id }) => colorMap[id] || "#4B5563"}  // Tailwind's gray-600
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

      {/* Custom Legend */}
      <div className="pt-3 space-y-1 text-sm">
        {[...data]
          .sort((a, b) => b.revenue - a.revenue)
          .map(({ service, revenue }) => (
            <div
              key={service}
              onClick={() =>
                setActiveId((prev) => (prev === service ? null : service))
              }
              className={`flex items-center gap-2 cursor-pointer ${
                activeId === service ? "text-white font-bold" : "text-gray-300"
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: colorMap[service] || "#999" }}
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