import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function DevAdmin() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/dev/clients", {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then((res) => setClients(res.data))
      .catch((err) => {
        console.error("❌ Failed to load clients", err);
        setError("Failed to load clients");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("dev_logged_in");
    navigate("/dev-login");
  };

  const handleViewSlots = (client) => {
    navigate(`/dev/slots/${client.id}`, {
      state: {
        name: client.name,
        email: client.email,
      },
    });
  };

  const handleViewBookings = (client) => {
    navigate(`/dev/appointments/${client.id}`, {
      state: {
        name: client.name,
        email: client.email,
      },
    });
  };

  const handleDelete = (clientId) => {
    if (
      !window.confirm(
        "Are you sure? This deletes all their slots and bookings."
      )
    )
      return;
    axios
      .delete(`http://127.0.0.1:5000/dev/clients/${clientId}`, {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then(() => {
        // Re-fetch clients to stay in sync with DB
        return axios.get("http://127.0.0.1:5000/dev/clients", {
          headers: { "X-Dev-Auth": "secret123" },
        });
      })
      .then((res) => setClients(res.data))
      .catch((err) => {
        console.error("❌ Failed to delete client", err);
        alert("Failed to delete client. Try again.");
      });
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">Developer Admin Panel</h2>

      <button
        className="btn btn-sm btn-primary w-full"
        onClick={() => navigate("/dev/new-client")}
      >
        ➕ Add New Client
      </button>

      {loading && <p className="text-center">Loading clients...</p>}
      {error && <p className="text-red-500 text-center">{error}</p>}

      <div className="space-y-4">
        {clients.map((client) => (
          <div
            key={client.id}
            className="p-4 bg-base-200 border rounded shadow-sm"
          >
            <p className="font-bold">{client.name}</p>
            <p className="text-sm text-gray-400">{client.email}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="btn btn-xs btn-outline"
                onClick={() => handleViewSlots(client)}
              >
                View Slots
              </button>
              <button
                className="btn btn-xs btn-outline"
                onClick={() => handleViewBookings(client)}
              >
                View Bookings
              </button>
              <button
                className="btn btn-xs btn-error hover:scale-105 transition-transform"
                onClick={() => handleDelete(client.id)}
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
