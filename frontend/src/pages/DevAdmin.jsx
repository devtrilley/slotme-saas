import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function DevAdmin() {
  const [freelancers, setFreelancer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/dev/freelancers", {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then((res) =>
        setFreelancer(
          res.data.sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch((err) => {
        console.error("❌ Failed to load freelancers", err);
        setError("Failed to load freelancers");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("dev_logged_in");
    navigate("/dev-login");
  };

  const handleViewSlots = (freelancer) => {
    navigate(`/dev/slots/${freelancer.id}`, {
      state: {
        name: freelancer.name,
        email: freelancer.email,
      },
    });
  };

  const handleViewBookings = (freelancer) => {
    navigate(`/dev/appointments/${freelancer.id}`, {
      state: {
        name: freelancer.name,
        email: freelancer.email,
      },
    });
  };

  const handleDelete = (freelancerId) => {
    if (
      !window.confirm(
        "Are you sure? This deletes all their slots and bookings."
      )
    )
      return;
    axios
      .delete(`http://127.0.0.1:5000/dev/freelancers/${freelancerId}`, {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then(() => {
        // Re-fetch freelancers to stay in sync with DB
        return axios.get("http://127.0.0.1:5000/dev/freelancers", {
          headers: { "X-Dev-Auth": "secret123" },
        });
      })
      .then((res) =>
        setFreelancer(
          res.data.sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch((err) => {
        console.error("❌ Failed to delete freelancer", err);
        alert("Failed to delete freelancer. Try again.");
      });
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">Developer Admin Panel</h2>

      <p className="text-sm text-center text-gray-400">
        {freelancers.length} freelancer{freelancers.length !== 1 && "s"} found
      </p>

      <button
        className="btn btn-sm btn-primary w-full"
        onClick={() => navigate("/dev/new-freelancer")}
      >
        ➕ Add New Freelancer
      </button>

      {loading && <p className="text-center">Loading freelancers...</p>}
      {error && <p className="text-red-500 text-center">{error}</p>}

      <div className="space-y-4">
        {freelancers.map((freelancer) => (
          <div
            key={freelancer.id}
            className="p-4 bg-base-200 border rounded shadow-sm"
          >
            <p className="font-bold">{freelancer.name}</p>
            <p className="text-sm text-gray-400">{freelancer.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="btn btn-xs btn-outline"
                onClick={() => handleViewSlots(freelancer)}
              >
                View Slots
              </button>
              <button
                className="btn btn-xs btn-outline"
                onClick={() => handleViewBookings(freelancer)}
              >
                View Bookings
              </button>
              <button
                className="btn btn-xs btn-error hover:scale-105 transition-transform"
                onClick={() => handleDelete(freelancer.id)}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleLogout} className="btn btn-sm btn-error w-full">
        Logout
      </button>
    </div>
  );
}
