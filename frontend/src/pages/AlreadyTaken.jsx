import { useNavigate, useSearchParams } from "react-router-dom";

export default function AlreadyTaken() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const freelancerId = params.get("freelancer_id");

  return (
    <main
      role="main"
      className="h-screen flex flex-col justify-center items-center bg-base-200 text-center p-4"
    >
      <section aria-labelledby="already-taken-heading" className="max-w-lg">
        <header>
          <h1
            id="already-taken-heading"
            className="text-4xl font-bold text-error mb-4"
          >
            Sorry, That Slot's Already Taken
          </h1>
        </header>
  
        <p className="text-lg mb-6 leading-relaxed">
          Looks like someone booked that slot before you finished confirming.
          No worries — you can pick another available time with the same freelancer!
        </p>
  
        <nav aria-label="Booking options">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(`/book/${freelancerId || ""}`)}
          >
            View Available Times
          </button>
        </nav>
      </section>
    </main>
  );
}
