import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import FreelancerBranding from "../components/Forms/FreelancerBranding";
import { showToast } from "../utils/toast";
import AddSlotForm from "../components/Forms/AddSlotForm";
import IconDatePicker from "../components/Inputs/IconDatePicker";
import "react-datepicker/dist/react-datepicker.css";
import FreelancerCard from "../components/Cards/FreelancerCard";
import FreelancerModal from "../components/Modals/FreelancerModal";
import ServiceCard from "../components/Cards/ServiceCard";
import ServiceForm from "../components/Forms/ServiceForm";
import { DateTime } from "luxon";
import TierStatusCard from "../components/Cards/TierStatusCard";
import { API_BASE } from "../utils/constants";
import ErrorCard from "../components/Cards/ErrorCard";
import SafeLoader from "../components/Layout/SafeLoader";
import RefreshButton from "../components/Buttons/RefreshButton";
import SortButton from "../components/Buttons/SortButton";
import FilterButton from "../components/Buttons/FilterButton";
import AccordionSection from "../components/Layout/AccordionSection";
import TipChip from "../components/Callouts/TipChip";
import TimeSlotCard from "../components/Cards/TimeSlotCard";
import InternalBookingModal from "../components/Modals/InternalBookingModal";
import CustomQuestionsForm from "../components/Forms/CustomQuestionsForm";
import ConfirmModal from "../components/Modals/ConfirmModal";
import { useFreelancer } from "../context/FreelancerContext";
import {
  isSlotInPast,
  formatSlotTimeParts,
  formatSlotDate,
  formatSlotTimePartsFromLocal,
  isSlotOnDate,
} from "../utils/timezoneHelpers";

export default function AdminPage() {
  const { freelancer, setFreelancer, clearFreelancer, isLoaded } =
    useFreelancer();
  const freelancerId = freelancer?.id;
  // Token check for gated routes
  const isLoggedIn = !!localStorage.getItem("access_token");

  // If localStorage is loaded but no freelancer data AND we have a token,
  // that means we need to fetch fresh data
  const needsFreelancerData = !freelancer && isLoggedIn;
  const navigate = useNavigate();

  const [syncDates, setSyncDates] = useState(() => {
    const saved = localStorage.getItem("date_sync_enabled");
    return saved === "true";
  });

  // Add this useEffect to persist the toggle
  useEffect(() => {
    localStorage.setItem("date_sync_enabled", syncDates.toString());
  }, [syncDates]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem("admin_selected_date");
    return saved ? new Date(saved) : new Date();
  });

  // 🔥 ADD THIS useEffect to persist the date
  useEffect(() => {
    localStorage.setItem("admin_selected_date", selectedDate.toISOString());
  }, [selectedDate]);

  const [servicesError, setServicesError] = useState(false);
  const [freelancerDetailsLoadError, setFreelancerDetailsLoadError] =
    useState(false);
    const [freelancerDetails, setFreelancerDetails] = useState(() => {
      // Try to get from localStorage directly to avoid context timing issues
      const stored = localStorage.getItem("freelancer");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.warn("Failed to parse stored freelancer data");
        }
      }
      // Fallback to context or empty defaults
      return freelancer || {
        business_name: "",
        first_name: "",
        last_name: "",
        logo_url: "",
        tagline: "",
        bio: "",
        is_verified: false,
        tier: "free",
      };
    });

  // 🔥 AUTO-SYNC freelancerDetails when context freelancer updates
  useEffect(() => {
    if (freelancer) {
      setFreelancerDetails((prev) => ({
        ...prev,
        ...freelancer,
      }));
    }
  }, [freelancer]);

  const freelancerTimezone = freelancerDetails.timezone || "America/New_York";

  const [showInternalModal, setShowInternalModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [services, setServices] = useState([]);
  const [sortDirection, setSortDirection] = useState("asc");

  const [showFilters, setShowFilters] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [timezoneFilter, setTimezoneFilter] = useState("all"); // 🔥 NEW: Timezone filter

  const [showSlotConfirm, setShowSlotConfirm] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState(null);

  const [selectedSlotTime, setSelectedSlotTime] = useState("");
  const [selectedSlotDate, setSelectedSlotDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState(null); // ✅ FIXED

  const [selectedServiceForModal, setSelectedServiceForModal] = useState(null);

  const [slotTab, setSlotTab] = useState(() => {
    return localStorage.getItem("slot_tab") || "single";
  });

  const updateSlotTab = (mode) => {
    localStorage.setItem("slot_tab", mode);
    setSlotTab(mode);
  };

  const filteredSlots = slots.filter((slot) => {
    const isSameDay = isSlotOnDate(slot, selectedDate, freelancerTimezone);
    if (!isSameDay) return false;

    const isPast = isSlotInPast(slot, freelancerTimezone, true);
    const isBooked = slot.is_booked || slot.is_inherited_block;

    // 🔥 NEW: Timezone filter
    if (timezoneFilter !== "all" && slot.timezone !== timezoneFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === "all") return true;
    if (statusFilter === "available" && !isBooked && !isPast) return true;
    if (statusFilter === "booked" && isBooked) return true;
    if (statusFilter === "passed" && !isBooked && isPast) return true;

    return false;
  });

  // 🔥 NEW: Group by timezone, then sort chronologically within each group
  const sortedFilteredSlots = [...filteredSlots].sort((a, b) => {
    const timezoneA = a.timezone || freelancerTimezone;
    const timezoneB = b.timezone || freelancerTimezone;

    // 🔥 FIRST: Group by timezone (alphabetical order for consistency)
    if (timezoneA !== timezoneB) {
      return timezoneA.localeCompare(timezoneB);
    }

    // 🔥 SECOND: Within same timezone, sort by time
    const dateA = DateTime.fromFormat(
      `${a.day} ${a.time_24h || a.time}`,
      "yyyy-MM-dd HH:mm",
      { zone: "UTC" }
    ).setZone(timezoneA);

    const dateB = DateTime.fromFormat(
      `${b.day} ${b.time_24h || b.time}`,
      "yyyy-MM-dd HH:mm",
      { zone: "UTC" }
    ).setZone(timezoneB);

    // Add validation in case parsing fails
    if (!dateA.isValid || !dateB.isValid) {
      console.error("Failed to parse slot dates:", { a, b, dateA, dateB });
      return 0;
    }

    return sortDirection === "asc"
      ? dateA.toMillis() - dateB.toMillis()
      : dateB.toMillis() - dateA.toMillis();
  });

  // Use this to simulate a 500 error
  // useEffect(() => {
  //   throw new Error("🔥 Simulated crash in AdminPage");
  // }, []);

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

  const handleDelete = () => {
    if (!slotToDelete) return;

    axios
      .delete(`${API_BASE}/slots/${slotToDelete}`)
      .then(() => {
        showToast("Slot deleted.", "success");
        quietFetchSlots();
      })
      .catch((err) => {
        console.error("❌ Delete failed:", err.response?.data || err.message);
        const msg = err.response?.data?.error || "Failed to delete slot";
        showToast(msg, "error");
      })
      .finally(() => {
        setShowSlotConfirm(false);
        setSlotToDelete(null);
      });
  };

  const handleDeleteService = async (serviceId) => {
    try {
      await axios.delete(`${API_BASE}/freelancer/services/${serviceId}`);
      showToast("Service deleted.", "success");
      await quietFetchServices(); // ✅ re-fetch full services list
    } catch (err) {
      console.error("❌ Failed to delete service", err);
      showToast("Couldn't delete service. Try again.", "error");
    }
  };

  const handleUpdatePrice = (serviceId, newPrice) => {
    axios
      .patch(`${API_BASE}/freelancer/services/${serviceId}`, {
        price_usd: newPrice,
      })
      .then(() => {
        showToast("Price updated.", "success");
        fetchServices();
      })
      .catch((err) => {
        console.error("❌ Failed to update price", err);
        showToast("Couldn't update price. Try again.", "error");
      });
  };

  const [freelancerDetailsUpdated, setFreelancerDetailsUpdated] = useState(0);

  const shareUrl =
    freelancer?.custom_url || freelancerDetails?.custom_url
      ? `${window.location.origin}/${
          freelancer?.custom_url || freelancerDetails?.custom_url
        }`
      : freelancer?.public_slug || freelancerDetails?.public_slug
      ? `${window.location.origin}/${
          freelancer?.public_slug || freelancerDetails?.public_slug
        }`
      : `${window.location.origin}/book/${
          freelancer?.id || freelancerDetails?.id
        }`;

  function getFreelancerDateString(date) {
    return DateTime.fromJSDate(date)
      .setZone(freelancerTimezone)
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

  const tier = freelancer?.tier || "free";

  function handleTierBlocked() {
    showToast(
      <span>
        This feature is for <strong>PRO</strong> or <strong>ELITE</strong>{" "}
        users.{" "}
        <a href="/upgrade#elite?need=pro" className="underline font-medium">
          Upgrade →
        </a>
      </span>,
      "error"
    );
  }

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    // No token = bounce
    if (!token) {
      navigate("/auth");
      return;
    }

    // Token exists but no freelancer = fetch it
    if (!freelancer) {
      fetchFreelancerDetails();
      return;
    }

    // Token and freelancer = fetch slots + services
    if (freelancer?.id) {
      fetchSlots();
      fetchServices();
    }
  }, [freelancer?.id, freelancerDetailsUpdated]);

  if (!isLoaded) {
    return <SafeLoader loading={true} />;
  }

  if (needsFreelancerData) {
    return <SafeLoader loading={true} />;
  }

  if (!freelancerId) {
    return (
      <SafeLoader
        loading={false}
        error="Your account session is missing."
        onRetry={() => (window.location.href = "/auth")}
      />
    );
  }

  return (
    <SafeLoader loading={loading}>
      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="flex flex-col gap-2 items-center">
          <h1 className="text-2xl font-bold text-center">
            Freelancer Admin Dashboard
          </h1>

          <button
            onClick={() => {
              localStorage.removeItem("freelancer_logged_in");
              localStorage.removeItem("access_token");
              localStorage.removeItem("freelancer_id");
              localStorage.removeItem("branding_updated");
              localStorage.removeItem("client_id");

              clearFreelancer(); // 👈 Reset in-memory context
              navigate("/auth");

              showToast("👋 Logged out successfully", "success");
            }}
            className="btn btn-sm btn-outline"
          >
            Logout
          </button>
        </div>
        {freelancer && (
          <TierStatusCard
            tier={freelancer.tier || "free"}
            error={freelancerDetailsLoadError}
            notLoggedIn={!isLoggedIn}
          />
        )}
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
              email={freelancerDetails.email}
              logoUrl={freelancer?.logo_url || freelancerDetails.logo_url}
              isVerified={freelancerDetails.is_verified}
              tagline={freelancerDetails.tagline}
              tier={tier}
              onClick={() => setShowModal(true)}
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
        <div className={`flex justify-center`}>
          <TipChip className="sticky top-16 z-10" />
        </div>
        <AccordionSection title="Account & Share Link" defaultOpen>
          <div className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow space-y-2">
            <p className="text-sm font-medium text-center">
              Your Public Booking Link
            </p>
            <p className="text-sm text-primary text-center break-words">
              {freelancerDetailsLoadError ||
              !isLoggedIn ||
              !freelancerDetails?.id
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
                    showToast("Link copied to clipboard!", "success");
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
        </AccordionSection>
        <AccordionSection
          title="Add / Generate Slots"
          subtitle="Single or batch"
        >
          <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
            <AddSlotForm
              onAdd={quietFetchSlots} // 🔥 FIXED: No more loading spinner/refresh
              syncWith={syncDates ? selectedDate : null}
              setSyncDate={syncDates ? setSelectedDate : null}
              mode={slotTab}
              setMode={updateSlotTab}
              freelancerTimezone={freelancerTimezone}
            />
          </section>
        </AccordionSection>

        <AccordionSection
          title="Date Sync"
          subtitle="Sync slot forms with time slots"
        >
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncDates}
              onChange={() => setSyncDates(!syncDates)}
              className="checkbox checkbox-sm mt-0.5 shrink-0"
              aria-label="Sync Add Slot & Batch Slot dates with Time Slots calendar"
            />

            <span className="text-sm leading-6">
              <span className="font-medium">
                Sync Add Slot & Batch Slot dates with Time Slots calendar
                <span className="opacity-70"> (recommended)</span>
              </span>

              {syncDates && (
                <span className="block mt-1 text-xs text-success italic">
                  ✅ Sync is active — slot forms follow calendar date
                </span>
              )}
            </span>
          </label>
        </AccordionSection>

        <AccordionSection title="Time Slots" subtitle="View, sort, filter">
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
                    <SortButton
                      direction={sortDirection}
                      onToggle={() =>
                        setSortDirection((prev) =>
                          prev === "asc" ? "desc" : "asc"
                        )
                      }
                    />
                  </div>

                  <FilterButton
                    label="Filter Status:"
                    options={["all", "available", "booked", "passed"]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />

                  {/* 🔥 NEW: Timezone filter */}
                  <FilterButton
                    label="Filter Timezone:"
                    options={[
                      "all",
                      ...Array.from(
                        new Set(
                          slots.map((s) => s.timezone || freelancerTimezone)
                        )
                      ).sort(),
                    ]}
                    value={timezoneFilter}
                    onChange={setTimezoneFilter}
                  />
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
                {(() => {
                  let lastTimezone = null;
                  return sortedFilteredSlots.map((slot, index) => {
                    const slotTimezone = slot.timezone || freelancerTimezone;
                    const showHeader = slotTimezone !== lastTimezone;
                    lastTimezone = slotTimezone;

                    return (
                      <div key={slot.id}>
                        {/* 🔥 Timezone group header */}
                        {showHeader && (
                          <div className="mt-4 mb-2 text-center">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {slotTimezone.replace("America/", "")} Timezone
                            </span>
                          </div>
                        )}

                        <TimeSlotCard
                          slot={slot}
                          freelancerTimezone={freelancerTimezone}
                          onClick={(slot) => {
                            if (slot._deleteAction) {
                              setSlotToDelete(slot.id);
                              setShowSlotConfirm(true);
                              return;
                            }

                            const { formattedTime, abbreviation } =
                              formatSlotTimeParts(slot, freelancerTimezone);
                            setSelectedSlotId(slot.id);
                            setSelectedSlotTime(
                              `${formattedTime} ${abbreviation}`
                            );
                            setSelectedSlotDate(slot.day);
                            setShowInternalModal(true);
                          }}
                        />
                      </div>
                    );
                  });
                })()}
              </>
            )}
          </section>
        </AccordionSection>

        <AccordionSection title="Add a Service" subtitle="Create offerings">
          <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
            <ServiceForm onServiceAdded={fetchServices} />
          </section>
        </AccordionSection>
        <AccordionSection title="Your Services" subtitle="Edit, price, delete">
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
                <ServiceCard
                  key={s.id}
                  service={s}
                  onUpdate={fetchServices}
                  onDelete={handleDeleteService}
                  setSelectedServiceForModal={setSelectedServiceForModal}
                />
              ))
            )}
          </section>
        </AccordionSection>
        <AccordionSection
          title="Custom Booking Questions"
          subtitle="(Optional) shown to clients before booking"
          tier={tier}
          requiredTier="pro"
          onTierBlocked={handleTierBlocked}
        >
          <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
            <CustomQuestionsForm />
          </section>
        </AccordionSection>
        <AccordionSection title="Branding" subtitle="Logo, bio, tagline">
          <section className="p-4 bg-base-200 border-2 border-white/40 rounded-xl shadow-sm space-y-4">
            <FreelancerBranding
              onUpdate={() => setFreelancerDetailsUpdated((n) => n + 1)}
            />
          </section>
        </AccordionSection>

        <InternalBookingModal
          visible={showInternalModal}
          onClose={() => setShowInternalModal(false)}
          services={services}
          selectedDate={new Date(selectedSlotDate)}
          refetch={handleRefresh}
          preselectedTime={selectedSlotTime}
          slotId={selectedSlotId}
          freelancerTimezone={freelancerTimezone} // ✅ pass here
        />

        {showSlotConfirm && (
          <ConfirmModal
            isOpen={showSlotConfirm}
            onClose={() => {
              setSlotToDelete(null);
              setShowSlotConfirm(false);
            }}
            onConfirm={handleDelete}
            title="Delete Time Slot?"
            message="Are you sure you want to delete this time slot?"
            confirmText="Yes, Delete It"
            cancelText="Keep Slot"
            serviceCardElement={
              slotToDelete && (
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <TimeSlotCard
                      slot={slots.find((s) => s.id === slotToDelete)}
                      showButton={false}
                      centered={true}
                      freelancerTimezone={freelancerTimezone}
                    />
                  </div>
                </div>
              )
            }
          />
        )}
      </main>
    </SafeLoader>
  );
}
