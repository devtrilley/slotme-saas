export default function FallbackText({
  value,
  fallback = "Not available",
  error = false,
  errorFallback = "Something went wrong",
  loading = false,
  loadingFallback = "Loading...",
  className = "",
}) {
  if (loading) {
    return <p className={className}>{loadingFallback}</p>;
  }

  if (error) {
    return <p className={`${className} text-red-400`}>{errorFallback}</p>;
  }

  if (!value || (typeof value === "string" && value.trim() === "")) {
    return <p className={`${className} text-gray-400`}>{fallback}</p>;
  }

  return <p className={className}>{value}</p>;
}