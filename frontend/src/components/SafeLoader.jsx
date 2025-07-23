import ErrorCard from "./ErrorCard";

export default function SafeLoader({ loading, error, onRetry, children }) {
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 space-y-3">
        <ErrorCard
          title="Something went wrong."
          message={error}
          icon="❌"
          variant="error"
          onRetry={onRetry}
        />
      </div>
    );
  }

  return <>{children}</>;
}
