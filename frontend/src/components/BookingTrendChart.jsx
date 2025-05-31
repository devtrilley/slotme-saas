import { ResponsiveLine } from "@nivo/line";

export default function BookingTrendChart({ trendData, signupDate }) {
  const formattedData = [
    {
      id: "Bookings",
      data:
        trendData.length === 1
          ? [
              { x: signupDate, y: 0 },
              ...trendData,
            ]
          : trendData,
    },
  ];

  return (
    <div className="bg-white/5 rounded-lg p-4 shadow space-y-4 min-h-[320px]">
      <h2 className="text-center text-sm font-semibold">
        Bookings Since{" "}
        {trendData?.[0]?.x
          ? new Date(trendData[0].x).toLocaleDateString("en-US")
          : "N/A"}
      </h2>
      <div className="w-full h-[220px]">
        <ResponsiveLine
          data={formattedData}
          margin={{ top: 30, right: 20, bottom: 35, left: 40 }}
          xScale={{ type: "point" }}
          yScale={{
            type: "linear",
            min: 0,
            max: "auto",
            stacked: false,
            nice: 2,
          }}
          curve="monotoneX"
          axisBottom={{
            tickRotation: -20,
            tickSize: 5,
            tickPadding: 8,
            format: (value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}/${String(
                date.getFullYear()
              ).slice(-2)}`;
            },
          }}
          axisLeft={{
            tickValues: [0, 1, 2, 3, 4, 5],
            tickSize: 5,
            tickPadding: 5,
          }}
          enablePoints={true}
          pointSize={6}
          pointColor="#fff"
          pointBorderWidth={2}
          pointBorderColor="#3b82f6"
          colors={{ scheme: "accent" }}
          lineWidth={2}
          useMesh={true}
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
          tooltip={({ point }) => (
            <div className="text-xs p-1 bg-white text-black rounded shadow">
              <strong>
                {new Date(point.data.xFormatted).toLocaleDateString("en-US", {
                  year: "2-digit",
                  month: "numeric",
                  day: "numeric",
                })}
              </strong>
              : {point.data.yFormatted}
            </div>
          )}
        />
      </div>
    </div>
  );
}