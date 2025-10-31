export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-bold mb-2">Page Not Found</h1>
      <p className="text-lg text-gray-400 mb-6">
        Error 404 — the page you’re looking for doesn’t exist.
      </p>
      <a href="/" className="btn btn-primary">
        Go Home
      </a>
    </main>
  );
}
