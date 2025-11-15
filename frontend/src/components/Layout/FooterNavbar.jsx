import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useFreelancer } from "../../context/FreelancerContext";

const BACK_KEY = "slotmeBackStack";
const FWD_KEY = "slotmeForwardStack";
const FLAG_KEY = "slotmeNavFlag";

export default function FooterNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { freelancer, isLoaded } = useFreelancer();
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Initialize stacks
  useEffect(() => {
    const backStack = JSON.parse(sessionStorage.getItem(BACK_KEY) || "[]");
    if (backStack.length === 0) {
      sessionStorage.setItem(BACK_KEY, JSON.stringify([location.pathname]));
      sessionStorage.setItem(FWD_KEY, JSON.stringify([]));
    }
  }, []);

  // Update navigation state
  useEffect(() => {
    const flag = sessionStorage.getItem(FLAG_KEY);
    const backStack = JSON.parse(sessionStorage.getItem(BACK_KEY) || "[]");
    const forwardStack = JSON.parse(sessionStorage.getItem(FWD_KEY) || "[]");
    const last = backStack[backStack.length - 1];

    if (flag === "back" || flag === "forward") {
      sessionStorage.removeItem(FLAG_KEY);
    } else {
      if (last !== location.pathname) {
        backStack.push(location.pathname);
        sessionStorage.setItem(BACK_KEY, JSON.stringify(backStack));
        sessionStorage.setItem(FWD_KEY, JSON.stringify([]));
      }
    }

    setCanGoBack(backStack.length > 1);
    setCanGoForward(forwardStack.length > 0);
  }, [location.pathname]);

  const goBack = () => {
    let backStack = JSON.parse(sessionStorage.getItem(BACK_KEY) || "[]");
    let forwardStack = JSON.parse(sessionStorage.getItem(FWD_KEY) || "[]");

    if (backStack.length > 1) {
      const current = backStack.pop();
      const previous = backStack[backStack.length - 1];
      forwardStack.push(current);

      sessionStorage.setItem(BACK_KEY, JSON.stringify(backStack));
      sessionStorage.setItem(FWD_KEY, JSON.stringify(forwardStack));
      sessionStorage.setItem(FLAG_KEY, "back");

      navigate(previous);
    }
  };

  const goForward = () => {
    let backStack = JSON.parse(sessionStorage.getItem(BACK_KEY) || "[]");
    let forwardStack = JSON.parse(sessionStorage.getItem(FWD_KEY) || "[]");

    if (forwardStack.length > 0) {
      const next = forwardStack.pop();
      backStack.push(next);

      sessionStorage.setItem(BACK_KEY, JSON.stringify(backStack));
      sessionStorage.setItem(FWD_KEY, JSON.stringify(forwardStack));
      sessionStorage.setItem(FLAG_KEY, "forward");

      navigate(next);
    }
  };

  const goToBookingPage = () => {
    if (!isLoaded || !freelancer) return;

    const path = freelancer.custom_url
      ? `/freelancers/${freelancer.custom_url}`
      : freelancer.public_slug
      ? `/freelancers/${freelancer.public_slug}`
      : `/freelancers/${freelancer.id}`;

    sessionStorage.setItem(FLAG_KEY, "push");
    navigate(path);
  };

  const isActive = (path) => location.pathname === path;
  const isBookingPageActive = () =>
    location.pathname.startsWith("/freelancers/");

  // Don't render if user disabled it
  if (freelancer?.show_footer_navbar === false) {
    return null;
  }

  return (
    <nav
      className="fixed left-0 right-0 z-[999] bg-base-100 border-t border-base-300 lg:hidden w-full"
      style={{
        bottom: "-1px",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1px)",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.1)",
        maxWidth: "100vw",
      }}
    >
      <div className="flex justify-around items-center h-16 px-2">
        {/* Back */}
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 ${
            canGoBack
              ? "active:scale-95 active:bg-base-200 hover:bg-base-200"
              : "opacity-30 cursor-not-allowed"
          }`}
          aria-label="Go Back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>

        {/* Profile Page (Public) */}
        <button
          onClick={() => {
            if (!isLoaded || !freelancer) return;
            const path = freelancer.custom_url
              ? `/freelancers/${freelancer.custom_url}`
              : freelancer.public_slug
              ? `/freelancers/${freelancer.public_slug}`
              : `/freelancers/${freelancer.id}`;
            sessionStorage.setItem(FLAG_KEY, "push");
            navigate(path);
          }}
          disabled={!isLoaded || !freelancer}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 ${
            !isLoaded || !freelancer
              ? "opacity-30 cursor-not-allowed"
              : `active:scale-95 ${
                  location.pathname.startsWith("/freelancers/")
                    ? "bg-primary/10 text-primary shadow-lg shadow-primary/20"
                    : "hover:bg-base-200"
                }`
          }`}
          aria-label="My Profile"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </button>

        {/* Dashboard (requires login) */}
        <button
          onClick={() => {
            if (!isLoaded || !freelancer) return;
            sessionStorage.setItem(FLAG_KEY, "push");
            navigate("/freelancer-admin", { replace: false });
          }}
          disabled={!isLoaded || !freelancer}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 ${
            !isLoaded || !freelancer
              ? "opacity-30 cursor-not-allowed"
              : `active:scale-95 ${
                  isActive("/freelancer-admin")
                    ? "bg-primary/10 text-primary shadow-lg shadow-primary/20"
                    : "hover:bg-base-200"
                }`
          }`}
          aria-label="Dashboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          </svg>
        </button>

        {/* Booking Page */}
        <button
          onClick={() => {
            if (!isLoaded || !freelancer) return;
            const path = freelancer.custom_url
              ? `/${freelancer.custom_url}`
              : freelancer.public_slug
              ? `/${freelancer.public_slug}`
              : `/book/${freelancer.id}`;
            sessionStorage.setItem(FLAG_KEY, "push");
            navigate(path);
          }}
          disabled={!isLoaded || !freelancer}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 ${
            !isLoaded || !freelancer
              ? "opacity-30 cursor-not-allowed"
              : `active:scale-95 ${
                  location.pathname.startsWith("/book/")
                    ? "bg-primary/10 text-primary shadow-lg shadow-primary/20"
                    : "hover:bg-base-200"
                }`
          }`}
          aria-label="Booking Page"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
        </button>

        {/* Forward */}
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 ${
            canGoForward
              ? "active:scale-95 active:bg-base-200 hover:bg-base-200"
              : "opacity-30 cursor-not-allowed"
          }`}
          aria-label="Go Forward"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      </div>
    </nav>
  );
}
