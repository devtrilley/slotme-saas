import { ResponsiveBar } from "@nivo/bar";
import { useState } from "react";

// Group bookings by week (start Monday)
function groupByWeek(data) {
  const grouped = {};
  data.forEach(({ x, y }) => {
    const date = new Date(x);
    const day = date.getDay(); // Sunday = 0
    const mondayOffset = (day + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10); // yyyy-mm-dd
    grouped[key] = (grouped[key] || 0) + y;
  });
  return Object.entries(grouped).map(([x, y]) => ({ x, y }));
}

// Group bookings by month (timezone-safe)
function groupByMonth(data) {
  const grouped = {};
  data.forEach(({ x, y }) => {
    const date = new Date(x);
    const key = date.toISOString().slice(0, 7); // yyyy-mm
    grouped[key] = (grouped[key] || 0) + y;
  });
  return Object.entries(grouped).map(([x, y]) => ({
    x: `${x}-01`,
    y,
  }));
}

export default function BookingTrendChart({ trendData, signupDate }) {
  const [viewMode, setViewMode] = useState("day"); // day | week | month

  let chartData = [...trendData];
  if (chartData.length === 1) {
    chartData = [{ x: signupDate, y: 0 }, ...chartData];
  }

  if (viewMode === "week") chartData = groupByWeek(chartData);
  else if (viewMode === "month") chartData = groupByMonth(chartData);

  // Sort left-to-right by real date
  chartData.sort((a, b) => new Date(a.x) - new Date(b.x));

  return (
    <div className="p-5 rounded-2xl
  bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950
  border border-slate-700
  shadow-md
  space-y-4 min-h-[320px]">
      <h2 className="text-center text-sm font-semibold">
        Bookings Since{" "}
        {trendData?.[0]?.x
          ? new Date(trendData[0].x).toLocaleDateString("en-US")
          : "N/A"}
      </h2>

      {/* Toggle */}
      <div className="flex justify-center gap-2 text-xs">
        {["day", "week", "month"].map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-2 py-1 rounded-full transition ${
              viewMode === mode
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-full h-[220px]">
        <ResponsiveBar
          data={chartData}
          keys={["y"]}
          indexBy="x"
          margin={{ top: 30, right: 20, bottom: 35, left: 40 }}
          padding={0.3}
          colors={() => "#4ade80"} // green-400 default (can replace with gradient logic)
          borderRadius={4}
          yScale={{
            type: "linear",
            min: 0,
            stacked: false,
            max: "auto",
            nice: true,
          }}
          axisBottom={{
            tickRotation: -20,
            tickSize: 5,
            tickPadding: 8,
            format: (value) => {
              const date = new Date(value);
              return viewMode === "month"
                ? `${date.toLocaleString("default", {
                    month: "short",
                  })} '${String(date.getFullYear()).slice(-2)}`
                : `${date.getMonth() + 1}/${date.getDate()}`;
            },
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickValues: 5,
            format: (v) => Math.floor(v),
          }}
          theme={{
            textColor: "#ccc",
            axis: {
              ticks: {
                text: { fill: "#ccc" },
              },
            },
            grid: {
              line: {
                stroke: "#444",
                strokeWidth: 1,
              },
            },
          }}
          tooltip={({ indexValue, value }) => {
            const date = new Date(indexValue);
            return (
              <div className="text-xs p-1 bg-white text-black rounded shadow">
                <strong>
                  {viewMode === "month"
                    ? date.toLocaleString("default", {
                        month: "short",
                        year: "2-digit",
                      })
                    : date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                </strong>
                : {value}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
