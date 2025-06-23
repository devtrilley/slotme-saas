import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import FreelancerCard from "../components/FreelancerCard";
import FreelancerModal from "../components/FreelancerModal";
import { API_BASE } from "../utils/constants";

export default function DevAdmin() {
  const [freelancers, setFreelancer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalFreelancer, setModalFreelancer] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${API_BASE}/dev/freelancers`, {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then((res) =>
        setFreelancer(
          res.data.sort((a, b) =>
            `${a.first_name} ${a.last_name}`.localeCompare(
              `${b.first_name} ${b.last_name}`
            )
          )
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
        name: `${freelancer.first_name} ${freelancer.last_name}`,
        email: freelancer.email,
      },
    });
  };

  const handleViewBookings = (freelancer) => {
    navigate(`/dev/appointments/${freelancer.id}`, {
      state: {
        name: `${freelancer.first_name} ${freelancer.last_name}`,
        email: freelancer.email,
      },
    });
  };

  const confirmDelete = (freelancerId) => {
    axios
      .delete(`${API_BASE}/dev/freelancers/${freelancerId}`, {
        headers: {
          "X-Dev-Auth": "secret123",
        },
      })
      .then(() => {
        return axios.get(`${API_BASE}/dev/freelancers`, {
          headers: { "X-Dev-Auth": "secret123" },
        });
      })
      .then((res) => {
        setFreelancer(
          res.data.sort((a, b) =>
            `${a.first_name} ${a.last_name}`.localeCompare(
              `${b.first_name} ${b.last_name}`
            )
          )
        );
        setShowDeleteModal(null);
      })
      .catch((err) => {
        console.error("❌ Failed to delete freelancer", err);
        alert("Failed to delete freelancer. Try again.");
        setShowDeleteModal(null);
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

      <div className="space-y-6">
        {freelancers.map((freelancer) => (
          <div key={freelancer.id}>
            <FreelancerCard
              first_name={freelancer.first_name}
              last_name={freelancer.last_name}
              business_name={freelancer.business_name}
              logoUrl={freelancer.logo_url}
              tagline={freelancer.tagline}
              bio={freelancer.bio}
              isVerified={freelancer.is_verified}
              onClick={() => setModalFreelancer(freelancer)}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="btn btn-xs btn-outline grow"
                onClick={() => handleViewSlots(freelancer)}
              >
                View Slots
              </button>
              <button
                className="btn btn-xs btn-outline grow"
                onClick={() => handleViewBookings(freelancer)}
              >
                View Bookings
              </button>
            </div>
            <div className="mt-2">
              <button
                className="btn btn-xs btn-error w-full"
                onClick={() => setShowDeleteModal(freelancer)}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="mt-6 py-4 btn btn-sm btn-error w-full"
      >
        Logout
      </button>

      {modalFreelancer && (
        <FreelancerModal
          freelancer={modalFreelancer}
          onClose={() => setModalFreelancer(null)}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-base-200 p-6 rounded-xl shadow-md w-[90%] max-w-md">
            <h3 className="text-xl font-bold text-center mb-2">
              Confirm Deletion
            </h3>
            <p className="text-center text-gray-400 mb-3">
              Are you sure you want to delete{" "}
              <strong className="underline">{showDeleteModal.name}</strong>?
              This action will:
            </p>
            <ul className="text-gray-400 list-disc list-inside space-y-1 text-sm mb-4">
              <li>Delete all time slots for this freelancer</li>
              <li>Remove all customer bookings and appointment data</li>
              <li>Erase profile information and branding</li>
              <li>Remove them from the public booking page</li>
            </ul>
            <p className="text-center text-sm text-gray-400 italic mb-5">
              This cannot be undone. Be sure you've exported any relevant data.
            </p>
            <div className="flex justify-between">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowDeleteModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-error btn-sm text-white"
                onClick={() => confirmDelete(showDeleteModal.id)}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
