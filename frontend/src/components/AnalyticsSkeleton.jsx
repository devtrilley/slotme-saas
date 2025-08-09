export default function AnalyticsSkeleton() {
  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-white animate-pulse">
      <div className="h-8 w-1/2 bg-white/10 rounded" />

      {/* Card 1: Stats Skeleton */}
      <div className="bg-white/5 rounded-lg p-4 shadow space-y-3">
        <div className="h-4 w-3/4 bg-white/10 rounded" />
        <div className="h-4 w-2/3 bg-white/10 rounded" />
        <div className="h-4 w-1/2 bg-white/10 rounded" />
        <div className="h-4 w-3/4 bg-white/10 rounded mt-3" />
        <div className="h-4 w-2/3 bg-white/10 rounded" />
      </div>

      {/* Card 2: Pie chart skeleton */}
      <div className="bg-white/5 rounded-lg p-4 shadow space-y-3">
        <div className="h-4 w-1/3 bg-white/10 rounded mx-auto" />
        <div className="w-full h-[220px] bg-white/10 rounded" />
      </div>

      {/* Card 3: Line chart skeleton */}
      <div className="bg-white/5 rounded-lg p-4 shadow space-y-3">
        <div className="h-4 w-2/5 bg-white/10 rounded mx-auto" />
        <div className="w-full h-[220px] bg-white/10 rounded" />
      </div>

      {/* Card 4: Revenue pie chart */}
      <div className="bg-white/5 rounded-lg p-4 shadow space-y-3">
        <div className="h-4 w-1/3 bg-white/10 rounded mx-auto" />
        <div className="w-full h-[220px] bg-white/10 rounded" />
      </div>
    </div>
  );
}
