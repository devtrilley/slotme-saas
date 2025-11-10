import { NavLink, useNavigate } from "react-router-dom";
import { closeTokenChannel } from "../../utils/tokenChannel";
import { showToast } from "../../utils/toast";
import { useLocation } from "react-router-dom";
import slotmeLogo from "../../assets/slotme-logo.svg";

import { useFreelancer } from "../../context/FreelancerContext"; // 👈 Already imported

export default function Navbar() {
  const navigate = useNavigate();
  const { freelancer, clearFreelancer } = useFreelancer(); // 🔥 ADD freelancer here
  const isDevLoggedIn = localStorage.getItem("dev_logged_in");
  const isFreelancerLoggedIn = localStorage.getItem("freelancer_logged_in");

  const navLinkClass = ({ isActive }) =>
    isActive ? "font-bold text-primary" : "";

  const handleLogout = (type) => {
    if (type === "dev") {
      localStorage.removeItem("dev_logged_in");
      navigate("/dev-login");
    } else if (type === "freelancer") {
      localStorage.removeItem("freelancer_logged_in");
      localStorage.removeItem("access_token");
      localStorage.removeItem("freelancer_id");
      localStorage.removeItem("branding_updated");
      localStorage.removeItem("client_id");

      clearFreelancer(); // 👈 Reset in-memory context
      navigate("/auth");
    }

    closeTokenChannel();
    showToast("Logged out successfully.", "success");
  };

  const renderLinks = () => (
    <>
      {/* Section 1: General Public Links */}
      <li className="menu-title text-xs text-gray-400 px-2">Public Tabs</li>
      <li>
        <NavLink className={navLinkClass} to="/">
          Home
        </NavLink>
      </li>
      <li>
        <NavLink className={navLinkClass} to="/upgrade">
          Upgrade
        </NavLink>
      </li>
      <li>
        <NavLink className={navLinkClass} to="/terms">
          Terms & Privacy
        </NavLink>
      </li>
      <li>
        <NavLink className={navLinkClass} to="/feedback">
          Feedback
        </NavLink>
      </li>

      {/* 👇 Show only when logged out */}
      {!isFreelancerLoggedIn && !isDevLoggedIn && (
        <li className="pt-2">
          <button
            onClick={() => navigate("/auth")}
            className="bg-gradient-to-r from-primary to-purple-600 text-white text-xs font-medium py-2 rounded-md w-full hover:opacity-90 transition"
          >
            Login / Sign Up
          </button>
        </li>
      )}

      {(isFreelancerLoggedIn || isDevLoggedIn) && (
        <div className="my-2 h-px bg-gray-600 opacity-40" />
      )}

      {/* Section 2: Freelancer Links */}
      {isFreelancerLoggedIn && (
        <>
          <li className="menu-title text-xs text-gray-400 px-2">
            My Account Tabs
          </li>
          <li>
            <NavLink className={navLinkClass} to="/freelancer-admin">
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink className={navLinkClass} to="/freelancer-bookings">
              CRM
            </NavLink>
          </li>
          <li>
            <NavLink className={navLinkClass} to="/qr-code">
              QR Code
            </NavLink>
          </li>
          <li>
            <NavLink
              className={navLinkClass}
              to={
                freelancer?.custom_url
                  ? `/freelancers/${freelancer.custom_url}`
                  : freelancer?.public_slug
                  ? `/freelancers/${freelancer.public_slug}`
                  : `/freelancers/${localStorage.getItem("freelancer_id")}`
              }
            >
              My Public Profile
            </NavLink>
          </li>
          <li>
            <NavLink className={navLinkClass} to="/freelancer-analytics">
              Analytics
            </NavLink>
          </li>
          <li>
            <NavLink className={navLinkClass} to="/priority-support">
              Priority Support
            </NavLink>
          </li>
          <li>
            <NavLink className={navLinkClass} to="/settings">
              Settings
            </NavLink>
          </li>
          <li>
            <button onClick={() => handleLogout("freelancer")}>
              Logout as Freelancer
            </button>
          </li>

          {isDevLoggedIn && (
            <div className="my-2 h-px bg-gray-600 opacity-40" />
          )}
        </>
      )}

      {/* Section 3: Developer Tools */}
      {isDevLoggedIn && (
        <>
          <li className="menu-title text-xs text-gray-400 px-2">
            Developer Tabs
          </li>
          <li>
            <NavLink className={navLinkClass} to="/dev-admin">
              Dev Panel
            </NavLink>
          </li>
          <li>
            <button onClick={() => handleLogout("dev")}>Logout as Dev</button>
          </li>
        </>
      )}
    </>
  );

  const location = useLocation();
  const stickyExceptions = ["/booking", "/upgrade"];
  const isSticky = !stickyExceptions.includes(location.pathname);

  return (
    <div
      className={`navbar bg-base-100 shadow-md px-4 ${
        isSticky ? "sticky top-0 z-50" : ""
      }`}
    >
      <div className="navbar-start flex items-center gap-2">
        {/* Always-visible hamburger dropdown (all screen sizes) */}
        <div className="dropdown">
          <label tabIndex={0} className="btn btn-ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </label>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52"
          >
            {renderLinks()}
          </ul>
        </div>
        <NavLink
          to="/"
          className="flex items-center h-full px-2"
          aria-label="SlotMe Home"
        >
          <img
            src={slotmeLogo}
            alt="SlotMe Logo"
            className="h-12 sm:h-16 w-auto"
          />
          <span className="sr-only">Home</span>
        </NavLink>
      </div>

      {/* Navbar end (right side) */}
      <div className="navbar-end hidden lg:flex items-center gap-5">
        {/* 👆 Only visible on large screens and up (desktop) */}

        {isFreelancerLoggedIn || isDevLoggedIn ? (
          <>
            <NavLink
              to="/freelancer-admin"
              className={({ isActive }) =>
                `hover:text-primary transition ${
                  isActive
                    ? "text-primary font-semibold border-b-2 border-primary pb-1"
                    : ""
                }`
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/freelancer-bookings"
              className={({ isActive }) =>
                `hover:text-primary transition ${
                  isActive
                    ? "text-primary font-semibold border-b-2 border-primary pb-1"
                    : ""
                }`
              }
            >
              CRM
            </NavLink>

            <NavLink
              to={
                freelancer?.custom_url
                  ? `/freelancers/${freelancer.custom_url}`
                  : freelancer?.public_slug
                  ? `/freelancers/${freelancer.public_slug}`
                  : `/freelancers/${localStorage.getItem("freelancer_id")}`
              }
              className={({ isActive }) =>
                `hover:text-primary transition ${
                  isActive
                    ? "text-primary font-semibold border-b-2 border-primary pb-1"
                    : ""
                }`
              }
            >
              Profile
            </NavLink>

            <NavLink
              to="/upgrade"
              className={({ isActive }) =>
                `hover:text-primary transition ${
                  isActive
                    ? "text-primary font-semibold border-b-2 border-primary pb-1"
                    : ""
                }`
              }
            >
              Upgrade
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `hover:text-primary transition ${
                  isActive
                    ? "text-primary font-semibold border-b-2 border-primary pb-1"
                    : ""
                }`
              }
            >
              Settings
            </NavLink>

            {/* 🔥 Red logout button (desktop only) */}
            <button
              onClick={() => handleLogout("freelancer")}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-sm hover:from-red-600 hover:to-rose-700 active:scale-95 transition"
            >
              Logout
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className="btn btn-primary btn-sm text-xs"
          >
            Login / Sign Up
          </button>
        )}
      </div>
    </div>
  );
}
