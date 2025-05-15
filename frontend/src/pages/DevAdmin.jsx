import { useNavigate } from "react-router-dom";

export default function DevAdmin() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("dev_logged_in");
    navigate("/dev-login");
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">Developer Admin Panel</h2>
      <p className="text-center text-gray-400">
        You’re logged in as DevAdmin. More tools coming soon...
      </p>
      <button onClick={handleLogout} className="btn btn-sm btn-error w-full">
        Logout
      </button>
    </div>
  );
}