// Pages/Home.jsx

import { Link } from "react-router-dom";
import slotmeLogo from "../assets/slotme-logo.svg";

export default function Home() {
  return (
    <div className="max-w-md mx-auto p-6 space-y-8 text-center">
      {/* Hero Section */}
      <div className="space-y-2">
        <h1 className="sr-only">SlotMe Scheduler</h1>
        <img
          src={slotmeLogo}
          alt="SlotMe Scheduler"
          className="mx-auto w-40 sm:w-48 md:w-56 lg:w-64 mb-4"
        />
        <p className="text-gray-400 text-sm">
          Modern appointment booking for freelancers, coaches, barbers,
          trainers, and more.
        </p>
        <p className="text-xs text-gray-500 italic">
          No sign-up needed for customers. Share your link. Get booked. Simple.
        </p>
      </div>

      {/* Demo Booking CTA */}
      {/* <div className="bg-base-200 border rounded-lg p-4 shadow space-y-2">
        <p className="text-sm text-gray-300 font-semibold">
          Want to see how it works?
        </p>
        <a
          href="/book/1"
          className="btn btn-outline btn-primary w-full"
        >
          Try Demo Booking Page
        </a>
      </div> */}

      {/* Freelancer and Dev Login CTA */}
      <div className="grid grid-cols-1 gap-3">
        <Link to="/auth" className="btn btn-primary w-full">
          Freelancer Login
        </Link>
        <Link to="/dev-login" className="btn btn-outline w-full">
          Developer Admin Login
        </Link>
      </div>

      {/* Feature Highlights */}
      <div className="space-y-4 pt-4 text-left">
        <h2 className="text-xl font-bold text-center">Why SlotMe?</h2>
        <ul className="list-inside text-sm text-gray-400 space-y-2">
          <li>✔️ Instant booking with no customer account required</li>
          <li>✔️ Mobile-optimized for fast scheduling on the go</li>
          <li>✔️ Each freelancer gets a branded booking page</li>
          <li>✔️ Built-in CRM and CSV export for leads</li>
          <li>
            ✔️ Upgrade options (coming soon): SMS reminders, analytics,
            integrations
          </li>
        </ul>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 pt-6 border-t">
        <p>&copy; 2025 SlotMe. All rights reserved.</p>
        <a href="/terms" className="link text-xs text-gray-400 hover:underline">
          Terms & Privacy
        </a>
      </div>
    </div>
  );
}
