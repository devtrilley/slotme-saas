import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import FreelancerBranding from "../components/FreelancerBranding";
import { showToast } from "../utils/toast";
import AddSlotForm from "../components/AddSlotForm";
import IconDatePicker from "../components/IconDatePicker";
import "react-datepicker/dist/react-datepicker.css";
import FreelancerCard from "../components/FreelancerCard";
import FreelancerModal from "../components/FreelancerModal";
import ServiceCard from "../components/ServiceCard";
import ServiceForm from "../components/ServiceForm";
import { DateTime } from "luxon";
import TierStatusCard from "../components/TierStatusCard";
import { API_BASE } from "../utils/constants";
import ErrorCard from "../components/ErrorCard";
import SafeLoader from "../components/SafeLoader";
import RefreshButton from "../components/RefreshButton";

import { useFreelancer } from "../context/FreelancerContext";

function getDateFromTimeStr(timeStr) {
  const [hourMinute, ampm] = timeStr.split(" ");
  let [hour, minute] = hourMinute.split(":").map(Number);
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function clearFreelancerSession() {
  [
    "freelancer_logged_in",
    "access_token",
    "freelancer_id",
    "freelancerDetails_updated",
    "client_id",
  ].forEach((key) => localStorage.removeItem(key));
}

export default function AdminPage() {
  const { freelancer, setFreelancer } = useFreelancer();

  const [syncDates, setSyncDates] = useState(false);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [servicesError, setServicesError] = useState(false);
  const [freelancerDetailsLoadError, setFreelancerDetailsLoadError] =
    useState(false);
  const [freelancerDetails, setFreelancerDetails] = useState({
    business_name: "",
    first_name: "",
    last_name: "",
    logo_url: "",
    tagline: "",
    bio: "",
    is_verified: false,
    tier: "free",
  });
  const [showModal, setShowModal] = useState(false);
  const [services, setServices] = useState([]);
  const [sortDirection, setSortDirection] = useState("asc");

  const [showFilters, setShowFilters] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");

  const [slotTab, setSlotTab] = useState(() => {
    return localStorage.getItem("slot_tab") || "single";
  });

  const updateSlotTab = (mode) => {
    localStorage.setItem("slot_tab", mode);
    setSlotTab(mode);
  };

  const cycleStatus = () => {
    setStatusFilter((prev) => {
      switch (prev) {
        case "all":
          return "available";
        case "available":
          return "booked";
        case "booked":
          return "passed";
        default:
          return "all";
      }
    });
  };

  const filteredSlots = slots.filter((slot) => {
    const isSameDay = slot.day === getESTDateString(selectedDate);
    if (!isSameDay) return false;

    const isPast = new Date(`${slot.day} ${slot.time}`) < new Date();
    const isBooked = slot.is_booked || slot.is_inherited_block;

    if (statusFilter === "all") return true;
    if (statusFilter === "available" && !isBooked && !isPast) return true;
    if (statusFilter === "booked" && isBooked) return true;
    if (statusFilter === "passed" && !isBooked && isPast) return true;

    return false;
  });

  const sortedFilteredSlots = [...filteredSlots].sort((a, b) => {
    const dateA = new Date(`${a.day} ${a.time}`);
    const dateB = new Date(`${b.day} ${b.time}`);
    return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
  });
  const navigate = useNavigate();

  // Use this to simulate a 500 error
  // useEffect(() => {
  //   throw new Error("🔥 Simulated crash in AdminPage");
  // }, []);

  const freelancerId = freelancer?.id;

  const isLoggedIn = !!localStorage.getItem("access_token");

  const fetchSlots = () => {
    if (!freelancerId) {
      setFetchError("Missing freelancer ID");
      return;
    }

    // -- TESTING FOR SPINNERS
    // setLoading(true);
    // setTimeout(() => {
    //   setLoading(false); // simulate end of load
    // }, 4000);
    // return; // skip actual request

    setLoading(true);
    axios
      .get(`${API_BASE}/freelancer/slots/${freelancerId}`)
      .then((res) => {
        setSlots(res.data);
        setFetchError("");
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots", err);
        setFetchError("Could not load time slots.");
      })
      .finally(() => setLoading(false));
  };

  const fetchServices = () => {
    axios
      .get(`${API_BASE}/freelancer/services`)
      .then((res) => {
        setServices(res.data);
        setServicesError(false);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch services", err);
        setServicesError(true);
      });
  };

  const fetchFreelancerDetails = () => {
    axios
      .get(`${API_BASE}/freelancer-info`)
      .then((res) => {
        const data = res.data;
        setFreelancerDetails({
          id: data.id,
          business_name: data.business_name || "",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          logo_url: data.logo_url || "",
          tagline: data.tagline || "",
          bio: data.bio || "",
          timezone: data.timezone || "America/New_York",
          is_verified: data.is_verified,
          tier: data.tier || "free", // <- added this line for safety
        });

        setFreelancer(data);
        localStorage.setItem("freelancer", JSON.stringify(data));
        setFreelancerDetailsLoadError(false);
      })
      .catch((err) => {
        console.error("❌ Failed to load freelancerDetails", err);
        setFreelancerDetailsLoadError(true); // set error
      });
  };

  const handleDelete = (slotId) => {
    if (!confirm("Are you sure you want to delete this time slot?")) return;

    axios
      .delete(`${API_BASE}/slots/${slotId}`)
      .then(() => {
        showToast("Slot deleted");
        quietFetchSlots();
      })
      .catch((err) => {
        console.error("❌ Delete failed:", err.response?.data || err.message);
        const msg = err.response?.data?.error || "Failed to delete slot";
        showToast(msg, "error");
      });
  };

  const handleDeleteService = (serviceId) => {
    axios
      .delete(`${API_BASE}/freelancer/services/${serviceId}`)
      .then(() => {
        showToast("Service deleted");
        fetchServices();
      })
      .catch((err) => {
        console.error("❌ Failed to delete service", err);
        showToast("Could not delete service", "error");
      });
  };

  const handleUpdatePrice = (serviceId, newPrice) => {
    axios
      .patch(`${API_BASE}/freelancer/services/${serviceId}`, {
        price_usd: newPrice,
      })
      .then(() => {
        showToast("Price updated");
        fetchServices();
      })
      .catch((err) => {
        console.error("❌ Failed to update price", err);
        showToast("Could not update price", "error");
      });
  };

  const [freelancerDetailsUpdated, setFreelancerDetailsUpdated] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return; // Prevent background calls when not logged in

    fetchSlots();
    fetchFreelancerDetails();
    fetchServices();
  }, [freelancerDetailsUpdated]);

  const shareUrl = freelancerDetails?.custom_url
    ? `http://localhost:5173/${freelancerDetails.custom_url}`
    : `http://localhost:5173/book/${freelancerDetails.id}`; // fallback

  function getESTDateString(date) {
    return DateTime.fromJSDate(date)
      .setZone(freelancerDetails.timezone || "America/New_York")
      .toFormat("yyyy-MM-dd");
  }

  // "quiet" = don't visually disturb user, refresh under the hood. "loud" = everyone knows
  const quietFetchSlots = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/freelancer/slots/${freelancerId}`
      );
      setSlots(res.data);
      setFetchError("");
    } catch (err) {
      console.error("❌ Failed to fetch slots (quiet):", err);
    }
  };

  const quietFetchFreelancerDetails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/freelancer-info`);
      const data = res.data;
      setFreelancerDetails({
        id: data.id,
        business_name: data.business_name || "",
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        logo_url: data.logo_url || "",
        tagline: data.tagline || "",
        bio: data.bio || "",
        timezone: data.timezone || "America/New_York",
        is_verified: data.is_verified,
        tier: data.tier || "free",
      });
      setFreelancer(data);
      localStorage.setItem("freelancer", JSON.stringify(data));
      setFreelancerDetailsLoadError(false);
    } catch (err) {
      console.error("❌ Failed to fetch freelancerDetails (quiet):", err);
      setFreelancerDetailsLoadError(true);
    }
  };

  const quietFetchServices = async () => {
    try {
      const res = await axios.get(`${API_BASE}/freelancer/services`);
      setServices(res.data);
      setServicesError(false);
    } catch (err) {
      console.error("❌ Failed to fetch services (quiet):", err);
      setServicesError(true);
    }
  };

  const handleRefresh = async () => {
    showToast("Refreshing dashboard...", "refresh", 2000);
    await Promise.all([
      quietFetchSlots(),
      quietFetchFreelancerDetails(),
      quietFetchServices(),
    ]);
  };

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Filter button classes
  const getFilterButtonClass = () => {
    switch (statusFilter) {
      case "available":
        return "bg-green-600 hover:bg-green-700 text-white border-green-600";
      case "booked":
        return "btn-primary text-white";
      case "passed":
        return "bg-gray-500 text-white border-gray-500 hover:bg-gray-600";
      default:
        return "btn-outline"; // "all"
    }
  };

  // Sort button classes
  const getSortButtonClass = () =>
    sortDirection === "asc"
      ? "bg-blue-500/10 text-blue-500 border border-blue-500 hover:bg-blue-500/20"
      : "bg-blue-600 text-white border border-blue-600 hover:bg-blue-700";

  return (
    <SafeLoader
      loading={loading}
      error={!freelancerId ? "Your account session is missing." : null}
      onRetry={() => (window.location.href = "/auth")}
    >
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-2 items-center">
          <h2 className="text-2xl font-bold text-center">
            Freelancer Admin Dashboard
          </h2>

          <button
            onClick={() => navigate("/freelancer-analytics")}
            className="btn btn-sm btn-outline"
          >
            📊 View Analytics
          </button>

          <button
            onClick={() => {
              clearFreelancerSession();
              navigate("/auth");
            }}
            className="btn btn-sm btn-outline"
          >
            Logout
          </button>
        </div>

        <TierStatusCard
          tier={isLoggedIn ? freelancer?.tier : null}
          error={freelancerDetailsLoadError}
          notLoggedIn={!isLoggedIn}
        />

        {freelancerDetailsLoadError ? (
          <ErrorCard
            title="We couldn’t load your freelancerDetails info."
            message="Please check your internet or try logging in again."
            onRetry={() => window.location.reload()}
            variant="error"
            icon="❌"
          />
        ) : (
          <>
            <FreelancerCard
              business_name={freelancerDetails.business_name}
              first_name={freelancerDetails.first_name}
              last_name={freelancerDetails.last_name}
              logoUrl={freelancerDetails.logo_url}
              tagline={freelancerDetails.tagline}
              bio={freelancerDetails.bio}
              isVerified={freelancerDetails.is_verified}
              onClick={() => setShowModal(true)}
              tier={freelancer.tier}
            />

            {showModal && (
              <FreelancerModal
                freelancer={{
                  ...freelancerDetails,
                  id: freelancerDetails.id || null,
                }}
                onClose={() => setShowModal(false)}
              />
            )}
          </>
        )}

        <div className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow space-y-2">
          <p className="text-sm font-medium text-center">
            Your Public Booking Link
          </p>
          <p className="text-sm text-primary text-center break-words">
            {freelancerDetailsLoadError || !isLoggedIn || !freelancerDetails?.id
              ? "Booking link unavailable — your account details could not be loaded."
              : shareUrl}
          </p>
          {freelancerDetailsLoadError ||
          !isLoggedIn ||
          !freelancerDetails?.id ? null : (
            <div className="flex justify-center gap-2">
              <button
                className="btn btn-xs btn-outline"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  showToast("Link copied to clipboard!");
                }}
              >
                Copy Link
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-primary"
              >
                Go to Booking Page
              </a>
            </div>
          )}
        </div>

        <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
          <AddSlotForm
            onAdd={fetchSlots}
            syncWith={syncDates ? selectedDate : null}
            setSyncDate={syncDates ? setSelectedDate : null}
            mode={slotTab}
            setMode={updateSlotTab}
          />
        </section>

        <div className="flex items-center gap-2 justify-center">
          <input
            type="checkbox"
            checked={syncDates}
            onChange={() => setSyncDates(!syncDates)}
            className="checkbox checkbox-sm"
          />
          <label className="text-sm">
            Sync Add Slot & Batch Slot dates with Time Slots calendar
            (recommended)
          </label>
        </div>
        {syncDates && (
          <p className="text-center text-xs text-success italic -mt-2">
            ✅ Sync is active — slot forms follow calendar date
          </p>
        )}

        <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-center border-b pb-1">
            Your Time Slots
          </h3>

          <label className="text-sm text-gray-400 block text-center">
            Select a date to view / edit your time slots:
          </label>
          <div className="flex justify-center">
            <RefreshButton
              onRefresh={handleRefresh}
              toastMessage="🔄 Refreshing time slots..."
            />
          </div>
          <div className="relative w-full">
            <IconDatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              className="input input-bordered w-full pl-10"
              wrapperClassName="w-full"
              dateFormat="MMMM d, yyyy"
              placeholderText="Choose a date"
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              📅
            </span>
          </div>

          <div className="flex flex-col items-center gap-2 mt-4">
            {/* ✅ Toggle goes outside of conditional block */}
            <div className="text-center mt-2">
              <button
                className="text-sm text-blue-400 hover:underline transition underline"
                onClick={() => setShowFilters((prev) => !prev)}
              >
                {showFilters ? "Hide Sort & Filter" : "Show Sort & Filter"}
              </button>
            </div>

            {/* ✅ Sort & Filter only rendered if toggled on */}
            {showFilters && (
              <div className="flex flex-col items-center gap-2 mt-4">
                <div className="flex flex-col items-center w-full gap-1">
                  <span className="text-sm text-gray-400">Sort:</span>
                  <button
                    className={`btn btn-sm w-full max-w-[10rem] rounded-full font-medium tracking-tight ${getSortButtonClass()} transition-colors duration-200 ease-in-out`}
                    onClick={() =>
                      setSortDirection((prev) =>
                        prev === "asc" ? "desc" : "asc"
                      )
                    }
                  >
                    {sortDirection === "asc"
                      ? "↑ Oldest First"
                      : "↓ Newest First"}
                  </button>
                </div>

                <div className="flex flex-col items-center w-full gap-1">
                  <span className="text-sm text-gray-400">Filter:</span>
                  <button
                    className={`btn btn-sm w-full max-w-[10rem] ${getFilterButtonClass()} transition-colors duration-200 ease-in-out`}
                    onClick={cycleStatus}
                  >
                    {statusFilter === "all"
                      ? "📋 All"
                      : statusFilter === "available"
                      ? "✅ Available"
                      : statusFilter === "booked"
                      ? "📌 Booked"
                      : "⏱️ Passed"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {fetchError ? (
            <ErrorCard
              title="We couldn’t load your time slots."
              message="Try refreshing or check your internet connection."
              onRetry={handleRefresh}
              variant="warning"
              icon="🕒"
            />
          ) : filteredSlots.length === 0 ? (
            <p className="text-center text-sm text-gray-400">
              No slots for this day.
            </p>
          ) : (
            <>
              {sortedFilteredSlots.map((slot) => {
                const isPast =
                  new Date(`${slot.day} ${slot.time}`) < new Date();

                return (
                  <div
                    key={slot.id}
                    className={`p-4 rounded-xl shadow-sm border ${
                      slot.is_booked || slot.is_inherited_block
                        ? "border-primary bg-[rgba(139,92,246,0.10)]" // ⬅️ slightly bolder purple background
                        : isPast
                        ? "border-gray-400 bg-[rgba(107,114,128,0.2)]" // ⬅️ faint silver/gray
                        : "border-green-300 bg-[rgba(34,197,94,0.1)]" // ⬅️ faint mint green
                    }`}
                  >
                    <p className="text-xs text-gray-400 mb-1">
                      {formatDate(slot.day)}
                    </p>
                    <p className="text-lg font-semibold flex items-center gap-1">
                      {slot.time}
                      <span className="text-xs text-gray-400">UTC</span>
                    </p>

                    {slot.is_booked || slot.is_inherited_block ? (
                      slot.appointment?.name &&
                      slot.appointment?.email &&
                      !slot.is_inherited_block ? (
                        <>
                          <p className="text-sm text-primary font-medium">
                            Booked by:
                          </p>
                          <p className="text-sm text-primary">
                            {slot.appointment.name} ({slot.appointment.email})
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-primary italic">
                          Booked (part of earlier appointment)
                        </p>
                      )
                    ) : isPast ? (
                      <p className="text-sm text-gray-400">⏱️ Passed</p>
                    ) : (
                      <p className="text-sm text-green-400">Available</p>
                    )}

                    {!slot.is_booked && !slot.is_inherited_block && (
                      <button
                        onClick={() => handleDelete(slot.id)}
                        className="btn btn-xs btn-error mt-2"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </section>

        <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
          <ServiceForm onServiceAdded={fetchServices} />
        </section>

        <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
          {servicesError && services.length > 0 && (
            <ErrorCard
              title="Couldn't refresh your services."
              message="You're seeing the cached version below."
              variant="warning"
            />
          )}
          {services.length === 0 ? (
            <div className="text-center text-sm text-gray-400 italic">
              {servicesError
                ? "Unable to load list of services. Please check your internet or server status."
                : "No services available. Add one above!"}
            </div>
          ) : (
            services.map((s) => (
              <ServiceCard key={s.id} service={s} onUpdate={fetchServices} />
            ))
          )}
        </section>

        <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
          <FreelancerBranding
            onUpdate={() => setFreelancerDetailsUpdated((n) => n + 1)}
          />
        </section>
      </div>
    </SafeLoader>
  );
}
