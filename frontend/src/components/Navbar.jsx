import { Link, useNavigate } from "react-router-dom";
import { closeTokenChannel } from "../utils/tokenChannel";
import { showToast } from "../utils/toast";

export default function Navbar() {
  const navigate = useNavigate();
  const isDevLoggedIn = localStorage.getItem("dev_logged_in");
  const isFreelancerLoggedIn = localStorage.getItem("freelancer_logged_in");

  const handleLogout = (type) => {
    if (type === "dev") {
      localStorage.removeItem("dev_logged_in");
      closeTokenChannel();
      navigate("/dev-login");
    } else if (type === "freelancer") {
      localStorage.removeItem("freelancer_logged_in");
      localStorage.removeItem("access_token");
      localStorage.removeItem("freelancer_id");
      localStorage.removeItem("branding_updated");
      localStorage.removeItem("client_id");
      closeTokenChannel();
      showToast("👋 Logged out successfully", "success");
      navigate("/auth");
    }
  };

  const renderLinks = () => (
    <>
      <li>
        <Link to="/">Home</Link>
      </li>
      <li>
        <Link to="/upgrade">Upgrade</Link>
      </li>
      <li>
        <Link to="/terms">Terms & Privacy</Link>
      </li>
      <li>
        <Link to="/feedback">Feedback</Link>
      </li>

      {isFreelancerLoggedIn && (
        <>
          <li>
            <Link to="/freelancer-admin">Dashboard</Link>
          </li>
          <li>
            <Link to="/freelancer-bookings">CRM</Link>
          </li>
          <li>
            <Link to="/qr-code">QR Code</Link>
          </li>
          <li>
            <Link to="/freelancer-analytics">Analytics</Link>
          </li>
          <li>
            <Link to="/priority-support">Priority Support</Link>
          </li>
          <li>
            <button onClick={() => handleLogout("freelancer")}>Logout</button>
          </li>
        </>
      )}

      {isDevLoggedIn && (
        <>
          <li>
            <Link to="/dev-admin">Dev Panel</Link>
          </li>
          <li>
            <button onClick={() => handleLogout("dev")}>Logout</button>
          </li>
        </>
      )}
    </>
  );

  return (
    <div className="navbar bg-base-100 shadow-md px-4">
      <div className="navbar-start">
        {/* Mobile Dropdown */}
        <div className="dropdown">
          <label tabIndex={0} className="btn btn-ghost lg:hidden">
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
        <Link to="/" className="btn btn-ghost text-xl">
          SlotMe
        </Link>
      </div>

      <div className="navbar-end hidden lg:flex">
        <ul className="menu menu-horizontal px-1">{renderLinks()}</ul>
      </div>
    </div>
  );
}