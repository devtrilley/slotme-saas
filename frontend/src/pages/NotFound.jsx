export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <p className="text-xl text-gray-400 mb-6">Page not found.</p>
      <a href="/" className="btn btn-primary">Go Home</a>
    </div>
  );
}