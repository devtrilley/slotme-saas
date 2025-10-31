import { Link } from "react-router-dom";

export default function UpgradeCancelled() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">⚠️ Upgrade Cancelled</h1>
        <p className="text-lg">No worries—your plan wasn’t changed.</p>
        <Link
          to="/upgrade"
          className="mt-4 inline-block bg-white text-black px-4 py-2 rounded-lg font-semibold"
        >
          Try Again
        </Link>
      </div>
    </main>
  );
}
