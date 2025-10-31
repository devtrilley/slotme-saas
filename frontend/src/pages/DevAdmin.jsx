import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import FreelancerCard from "../components/Cards/FreelancerCard";
import FreelancerModal from "../components/Modals/FreelancerModal";
import { API_BASE } from "../utils/constants";
import RefreshButton from "../components/Buttons/RefreshButton";
import { showToast } from "../utils/toast";
import SortButton from "../components/Buttons/SortButton";
import FilterButton from "../components/Buttons/FilterButton";
import EditFreelancerModal from "../components/Modals/EditFreelancerModal";

export default function DevAdmin() {
  const [freelancers, setFreelancer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalFreelancer, setModalFreelancer] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [sortOption, setSortOption] = useState("tier");
  const [sortDirection, setSortDirection] = useState("asc");
  const [tierFilter, setTierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const fetchFreelancers = async () => {
    try {
      setError("");
      setLoading(true);
      const res = await axios.get(`${API_BASE}/dev/freelancers`);
      setFreelancer(sortFreelancers(res.data));
    } catch (err) {
      console.error("❌ Failed to load freelancers", err);
      setError("Failed to load freelancers");
    } finally {
      setLoading(false);
    }
  };

  const sortFreelancers = (list) => {
    const sorted = [...list];

    if (sortOption === "alpha") {
      sorted.sort((a, b) => {
        const cmp = `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`
        );
        if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp;
        return a.id - b.id; // Stable tiebreaker
      });
    } else if (sortOption === "tier") {
      const tiers = { elite: 3, pro: 2, free: 1 };
      sorted.sort((a, b) => {
        const cmp = (tiers[b.tier] || 0) - (tiers[a.tier] || 0);
        if (cmp !== 0) return sortDirection === "asc" ? -cmp : cmp;
        return a.id - b.id; // Stable tiebreaker
      });
    } else if (sortOption === "slots") {
      sorted.sort((a, b) => {
        const cmp = (b.slot_count || 0) - (a.slot_count || 0);
        if (cmp !== 0) return sortDirection === "asc" ? -cmp : cmp;
        return a.id - b.id; // Stable tiebreaker
      });
    }

    return sorted;
  };

  useEffect(() => {
    // Check if dev token exists
    const devToken = localStorage.getItem("dev_access_token");
    if (!devToken) {
      showToast("Dev login required.", "warning");
      navigate("/dev-login");
      return;
    }
    fetchFreelancers();
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

  const handleEditSubmit = (updatedData) => {
    axios
      .patch(`${API_BASE}/dev/freelancers/${showEditModal.id}`, updatedData)
      .then(() => {
        showToast("Freelancer updated.", "success");
        return axios.get(`${API_BASE}/dev/freelancers`);
      })
      .then((res) => {
        setFreelancer(sortFreelancers(res.data));
        setShowEditModal(null);
      })
      .catch((err) => {
        console.error("❌ Failed to update freelancer", err);
        showToast("Update failed. Try again.", "error");
      });
  };

  const confirmDelete = (freelancerId) => {
    axios
      .delete(`${API_BASE}/dev/freelancers/${freelancerId}`)
      .then(() => {
        showToast("Freelancer deleted.", "success");
        return axios.get(`${API_BASE}/dev/freelancers`);
      })
      .then((res) => {
        setFreelancer(sortFreelancers(res.data));
        setShowDeleteModal(null);
      })
      .catch((err) => {
        console.error("❌ Failed to delete freelancer", err);
        showToast("Delete failed. Try again.", "error");
        setShowDeleteModal(null);
      });
  };

  useEffect(() => {
    if (freelancers.length > 0) {
      setFreelancer(sortFreelancers(freelancers));
    }
  }, [sortOption, sortDirection]);

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold text-center">Developer Admin Panel</h1>

      <p className="text-sm text-center text-gray-400">
        {freelancers.length} freelancer{freelancers.length !== 1 && "s"} found
      </p>

      <button
        className="btn btn-sm btn-primary w-full"
        onClick={() => navigate("/dev/new-freelancer")}
      >
        ➕ Add New Freelancer
      </button>

      <div className="flex justify-center">
        <RefreshButton
          onRefresh={fetchFreelancers}
          className="btn-sm"
          toastMessage="Refreshing developers..."
        />
      </div>

      {loading && <p className="text-center">Loading freelancers...</p>}
      {error && <p className="text-red-500 text-center">{error}</p>}

      <div className="space-y-6">
        <div className="flex flex-col items-center gap-2 mt-2">
          <input
            type="text"
            placeholder="🔍 Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input input-bordered input-sm w-full max-w-xs"
          />

          <span className="text-sm text-gray-400">Sort Direction:</span>
          <SortButton
            direction={sortDirection}
            onToggle={() =>
              setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
            }
          />

          <FilterButton
            label="Filter by Tier:"
            options={["all", "free", "paid", "pro", "elite"]}
            value={tierFilter}
            onChange={setTierFilter}
          />
        </div>

        {freelancers
          .filter((f) => {
            // Tier filter
            if (tierFilter !== "all") {
              if (tierFilter === "paid") {
                if (f.tier !== "pro" && f.tier !== "elite") return false;
              } else if (f.tier !== tierFilter) {
                return false;
              }
            }

            // Search filter
            if (searchQuery) {
              const query = searchQuery.toLowerCase();
              const fullName = `${f.first_name} ${f.last_name}`.toLowerCase();
              const email = f.email.toLowerCase();
              const business = (f.business_name || "").toLowerCase();

              return (
                fullName.includes(query) ||
                email.includes(query) ||
                business.includes(query)
              );
            }

            return true;
          })
          .map((freelancer) => (
            <div
              key={freelancer.id}
              className={`border-l-4 pl-2 ${
                freelancer.tier === "elite"
                  ? "border-amber-500"
                  : freelancer.tier === "pro"
                  ? "border-purple-500"
                  : "border-gray-500"
              }`}
            >
              <FreelancerCard
                first_name={freelancer.first_name}
                last_name={freelancer.last_name}
                business_name={freelancer.business_name}
                email={freelancer.email}
                logoUrl={freelancer.logo_url}
                tagline={freelancer.tagline}
                bio={freelancer.bio}
                isVerified={freelancer.is_verified}
                onClick={() => setModalFreelancer(freelancer)}
                tier={freelancer.tier}
                showEmail={true}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  className="btn btn-xs btn-outline grow"
                  onClick={() => handleViewSlots(freelancer)}
                >
                  📅 Slots
                </button>
                <button
                  className="btn btn-xs btn-outline grow"
                  onClick={() => handleViewBookings(freelancer)}
                >
                  📋 Bookings
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  className="btn btn-xs btn-info flex-1"
                  onClick={() => setShowEditModal(freelancer)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-xs btn-error flex-1"
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
          showEmail={true}
        />
      )}

      {showEditModal && (
        <EditFreelancerModal
          freelancer={showEditModal}
          onClose={() => setShowEditModal(null)}
          onSubmit={handleEditSubmit}
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
    </main>
  );
}
