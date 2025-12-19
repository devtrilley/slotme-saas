import { useState, useEffect, useRef } from "react"; // ✅ Added useRef
import { useParams } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { DateTime } from "luxon";
import React from "react";
import "react-datepicker/dist/react-datepicker.css";
import FreelancerCard from "../components/Cards/FreelancerCard";
import FreelancerModal from "../components/Modals/FreelancerModal";
import NoShowPolicy from "../components/NoShowPolicy";
import FAQCard from "../components/Cards/FAQCard";
import IconDatePicker from "../components/Inputs/IconDatePicker";
import AddonSelectionModal from "../components/Modals/AddonSelectionModal";
import { showToast } from "../utils/toast";
import ServiceCard from "../components/Cards/ServiceCard";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/constants";
import HoneypotInput from "../components/Inputs/HoneypotInput";
import SafeLoader from "../components/Layout/SafeLoader";
import NoAvailableSlotsCard from "../components/Cards/NoAvailableSlotsCard";
import RefreshButton from "../components/Buttons/RefreshButton";
import ReturnToTodayButton from "../components/Buttons/ReturnToTodayButton";
import BookingInstructionsCard from "../components/Cards/BookingInstructionsCard";
import {
  getUserTimezone,
  getTimezoneAbbreviation,
  getTimezoneFullName,
  formatSlotDate,
  isSlotInPast,
  formatSlotTimeParts,
  isSlotOnDate,
} from "../utils/timezoneHelpers";

export default function BookingPage({ useCustomUrl = false }) {
  const params = useParams();
  const freelancerId = useCustomUrl ? params.custom_url : params.freelancerId;
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [freelancerDetails, setFreelancerDetails] = useState({
    first_name: "",
    last_name: "",
    business_name: "",
    logo_url: "",
    tagline: "",
    bio: "",
    is_verified: false,
    faq_items: [],
    tier: "",
    booking_instructions: "", // if used
    preferred_payment_methods: "", // if used
  });

  // Full public profile data for the freelancer being booked or viewed.
  const [freelancerTimeZone, setFreelancerTimeZone] = useState("EST");

  const sortSlots = (slots) => {
    return [...slots].sort((a, b) => {
      // 🔥 FIRST: Sort by day
      if (a.day !== b.day) {
        return a.day.localeCompare(b.day);
      }
      // 🔥 SECOND: Sort by timezone (use freelancerTimeZone as fallback)
      const tzA = a.timezone || freelancerTimeZone;
      const tzB = b.timezone || freelancerTimeZone;
      if (tzA !== tzB) {
        return tzA.localeCompare(tzB);
      }
      // 🔥 THIRD: Sort by UTC time within same timezone
      return a.time_24h.localeCompare(b.time_24h);
    });
  };
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedServiceDuration, setSelectedServiceDuration] = useState(0);
  const [addons, setAddons] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [noShowPolicy, setNoShowPolicy] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [honeypot, setHoneypot] = useState(""); // Test honeypot by changing default value
  const [submitting, setSubmitting] = useState(false);
  const [bookingStatus, setBookingStatus] = useState(null);
  // null = unknown, "pending", "confirmed", "none"
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [customQuestions, setCustomQuestions] = useState([]);
  const [customResponses, setCustomResponses] = useState({});

  const navigate = useNavigate();

  // ✅ Track when user returns from booking page
  useEffect(() => {
    // ✅ ALWAYS scroll to top when booking page loads
    window.scrollTo({ top: 0, behavior: "instant" });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("from") === "admin") {
      localStorage.setItem("onboarding_step6_visited", "true");
      showToast("✅ Onboarding step 6 complete!", "success");
    }
  }, []);

  useEffect(() => {
    if (!selectedSlotId) return;

    axios
      .get(`${API_BASE}/freelancer/questions/${freelancerId}`)
      .then((res) => {
        const data = res.data;
        if (data.enabled && Array.isArray(data.questions)) {
          setCustomQuestions(data.questions);
        } else {
          setCustomQuestions([]); // no display if disabled or malformed
        }
      });
  }, [selectedSlotId]);

  const userTimeZone = getUserTimezone();
  const getRequiredBlocks = (durationMinutes) =>
    Math.ceil(durationMinutes / 15);

  const handleRetry = () => {
    setError("");
    setLoading(true);
    fetchFreelancerInfo();
    fetchSlots();
  };

  const handleRefresh = async () => {
    showToast("Refreshing slots...", "refresh", 2000);
    try {
      const [slotsRes, infoRes, addonsRes] = await Promise.all([
        axios.get(`${API_BASE}/freelancer/slots/${freelancerId}`),
        axios.get(`${API_BASE}/freelancer/public-info/${freelancerId}`),
        axios.get(`${API_BASE}/freelancer/addons/${freelancerId}`),
      ]);
      setSlots(slotsRes.data);
      const data = infoRes.data;
      setFreelancerDetails({
        ...data,
        tier: data.tier?.toLowerCase() || "free",
      });
      setFreelancerTimeZone(data.timezone || "America/New_York");
      setNoShowPolicy(data.no_show_policy || "");

      const enabled = data.services || [];
      setServices(enabled);
      setAddons(addonsRes.data); // ✅ CORRECT - inside try block, after setting services

      if (enabled.length === 1) {
        setSelectedServiceId(enabled[0].id);
        setSelectedServiceDuration(enabled[0].duration_minutes || 0);
      }
    } catch (err) {
      console.error("❌ Failed to refresh", err);
      if (err.response?.status === 404) {
        setError("missing-freelancer");
      } else {
        setError("Booking page unavailable.");
      }
    }
  };

  // ✅ ADD THESE FUNCTIONS:
  const updateScrollButtons = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scrollCarousel = (direction) => {
    if (!carouselRef.current) return;
    const scrollAmount = 300; // One card width + gap
    carouselRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(updateScrollButtons, 300);
  };

  const scrollServiceIntoView = (serviceId) => {
    if (!carouselRef.current) return;
    const serviceCard = carouselRef.current.querySelector(
      `[data-service-id="${serviceId}"]`
    );
    if (serviceCard) {
      serviceCard.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
    setTimeout(updateScrollButtons, 300);
  };

  useEffect(() => {
    if (services.length > 0) {
      // ⏱ Delay to let carousel fully render before checking scroll state
      const timer = setTimeout(() => {
        updateScrollButtons();
      }, 100);

      const carousel = carouselRef.current;
      if (carousel) {
        carousel.addEventListener("scroll", updateScrollButtons);
      }

      return () => {
        clearTimeout(timer);
        if (carousel) {
          carousel.removeEventListener("scroll", updateScrollButtons);
        }
      };
    }
  }, [services]);

  const fetchFreelancerInfo = () => {
    axios
      .get(`${API_BASE}/freelancer/public-info/${freelancerId}`)
      .then((res) => {
        setFreelancerDetails({
          ...res.data,
          tier: res.data.tier?.toLowerCase() || "free",
        });
        setFreelancerTimeZone(res.data.timezone || "America/New_York");
        setNoShowPolicy(res.data.no_show_policy || "");
        const enabled = res.data.services || [];
        setServices(enabled);
        if (enabled.length === 1) {
          setSelectedServiceId(enabled[0].id);
          setSelectedServiceDuration(enabled[0].duration_minutes || 0);
        }
      })
      .catch((err) => {
        console.error("❌ Failed to fetch freelancer info", err);
        if (err.response?.status === 404) {
          setError("missing-freelancer");
        } else {
          setError("Booking page unavailable.");
        }
      });
  };

  const fetchAddons = async (identifier) => {
    try {
      const res = await axios.get(
        `${API_BASE}/freelancer/addons/${identifier}`
      );
      setAddons(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch add-ons", err);
      setAddons([]);
    }
  };

  const checkBookingStatus = async (targetEmail) => {
    try {
      const res = await axios.get(
        `${API_BASE}/check-booking-status/${freelancerId}`,
        { params: { email: targetEmail } }
      );

      if (res.data.status === "confirmed") {
        setBookingStatus("confirmed");
        return "confirmed";
      } else if (res.data.status === "pending") {
        setBookingStatus("pending");
        return "pending";
      } else {
        setBookingStatus("none");
        return "none";
      }
    } catch (err) {
      console.error("Booking status check failed", err);
      setBookingStatus("none"); // Explicitly reset to known state
      return "none";
    }
  };

  const [resendLoading, setResendLoading] = useState(false);

  const resendConfirmation = (appointmentId) => {
    if (resendLoading) return;
    setResendLoading(true);

    axios
      .post(`${API_BASE}/resend-confirmation/${appointmentId}`)
      .then(() => {
        showToast("Confirmation email sent.", "success");
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Resend failed.";

        if (msg.includes("already cancelled")) {
          showToast(
            "Appointment cancelled. Refresh to book again.",
            "warning",
            3000
          );
        } else if (msg.includes("already confirmed")) {
          showToast("Already confirmed. You're all set.", "info", 3000);
        } else {
          showToast(msg, "error", 3000);
        }
      })
      .finally(() => setResendLoading(false));
  };

  useEffect(() => {
    fetchSlots();
    fetchFreelancerInfo();
    fetchAddons(freelancerId);

    const params = new URLSearchParams(window.location.search);
    if (params.get("cancelled") === "true") {
      showToast("Booking cancelled.", "success");
      fetchSlots();
      setBookingStatus("none");
    }

    const interval = setInterval(() => {
      const lastBookingTime = localStorage.getItem("last_booking_time");
      if (lastBookingTime) {
        const elapsed = Date.now() - lastBookingTime;
        const COOLDOWN_MS = 90000; // 🧪 TESTING: Change to 20000 for 20 sec testing, 90000 for 90 sec prod
        const remaining = Math.max(0, COOLDOWN_MS - elapsed);
        setCooldownRemaining(Math.ceil(remaining / 1000));
      } else {
        setCooldownRemaining(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [freelancerId]);

  useEffect(() => {
    if (!email) return;
    const timeout = setTimeout(() => {
      checkBookingStatus(email); // Always check status — backend handles auth protection
    }, 500);
    return () => clearTimeout(timeout);
  }, [email]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE}/freelancer/slots/${freelancerId}`
      );
      console.log("🔍 RAW SLOTS FROM BACKEND:", res.data);
      console.log("🔍 Total slots:", res.data.length);
      console.log("🔍 First 5 slots:", res.data.slice(0, 5));
      setSlots(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch slots", err);
      setError("Booking page unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !selectedSlotId) return;
    setSubmitting(true);

    const res = await axios.get(`${API_BASE}/freelancer/slots/${freelancerId}`);
    const sorted = sortSlots(res.data);

    const latestSlot = sorted.find((s) => s.id === selectedSlotId);
    if (!latestSlot || latestSlot.is_booked || latestSlot.is_inherited_block) {
      const toastContent = (
        <div>
          <p className="font-semibold mb-2">This slot was just taken!</p>
          <button
            onClick={() => {
              fetchSlots();
              showToast("Refreshing...", "info", 1000);
            }}
            className="underline text-purple-200 hover:text-purple-100 cursor-pointer text-sm"
          >
            🔄 Click to refresh
          </button>
        </div>
      );
      showToast(toastContent, "error", 8000);
      setSelectedSlotId(null);
      setSubmitting(false);
      return;
    }

    const lastBookingTime = localStorage.getItem("last_booking_time");
    const now = Date.now();

    const COOLDOWN_MS = 90000; // 🧪 TESTING: Change to 20000 for 20s, 90000 for 90s
    if (lastBookingTime && now - lastBookingTime < COOLDOWN_MS) {
      showToast("Wait before booking again.", "warning");
      setSubmitting(false);
      return;
    }

    const emailRegex = /^[A-Za-z0-9]+[\w.-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      showToast("Enter a valid email address.", "warning");
      setSubmitting(false);
      return;
    }

    try {
      const status = await checkBookingStatus(email);

      const payload = {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        slot_id: selectedSlotId,
        service_id: selectedServiceId,
        selected_addon_ids: selectedAddonIds, // ✅ NEW
        website: honeypot?.trim() || "",
        custom_responses: customResponses,
        customer_timezone: userTimeZone,
      };

      payload.website = honeypot?.trim() || "";

      axios
        .post(`${API_BASE}/book`, payload)
        .then((res) => {
          if (res?.status !== 200 || !res?.data?.appointment_id) {
            throw new Error("Booking failed. Please try again.");
          }
          localStorage.setItem("last_booking_time", Date.now());
          setCooldownRemaining(Math.ceil(COOLDOWN_MS / 1000));
          showToast("Booking successful. Redirecting...", "success", 1500);
          fetchSlots();
          setSelectedSlotId(null);
          setSubmitting(false);
          setTimeout(() => {
            navigate(
              `/booking-success?appointment_id=${res.data.appointment_id}`
            );
          }, 1500);
        })
        .catch((err) => {
          const msg =
            err.response?.data?.error || err.message || "Booking failed";

          // Handle IP rate limit (429 status)
          if (
            err.response?.status === 429 ||
            msg.includes("booking too fast")
          ) {
            showToast(
              "⏸️ Slow down! You've made 2 bookings recently. Please wait a few minutes before booking again.",
              "warning",
              6000
            );
            setSubmitting(false);
            return;
          }

          // Handle maximum 3 bookings per day
          if (msg.includes("Maximum 3 bookings")) {
            showToast(
              "Max 3 bookings per day reached. Contact the freelancer directly for more.",
              "warning",
              6000
            );
            setSubmitting(false);
            return;
          }

          // Handle duplicate slot or pending booking
          if (msg.includes("already have a booking")) {
            const appointmentId = err.response?.data?.appointment_id;
            const bookingStatus = err.response?.data?.status;

            const toastContent = (
              <div>
                {bookingStatus === "pending" && (
                  <>
                    <p className="font-semibold mb-1">
                      You have a pending booking for this time!
                    </p>
                    <p className="text-sm mb-2">Check your email to confirm.</p>
                    {appointmentId && (
                      <button
                        className="underline text-purple-200 hover:text-purple-100 cursor-pointer text-sm"
                        disabled={resendLoading}
                        onClick={() => resendConfirmation(appointmentId)}
                      >
                        📧 Resend confirmation email
                      </button>
                    )}
                  </>
                )}

                {bookingStatus === "confirmed" && (
                  <>
                    <p className="font-semibold mb-2">
                      This slot is already booked by you!
                    </p>
                    <button
                      onClick={() => {
                        fetchSlots();
                        showToast("Refreshing...", "info", 1000);
                      }}
                      className="underline text-purple-200 hover:text-purple-100 cursor-pointer text-sm"
                    >
                      🔄 Click to refresh
                    </button>
                  </>
                )}
              </div>
            );

            showToast(toastContent, "error", 8000);
            setSubmitting(false);
            return;
          }

          // Generic error fallback
          const hasRefreshAction =
            msg.includes("unavailable") ||
            msg.includes("no longer") ||
            msg.includes("already");

          if (hasRefreshAction) {
            const toastContent = (
              <div>
                <p className="font-semibold mb-2">Booking unavailable</p>
                <button
                  onClick={() => {
                    fetchSlots();
                    showToast("Refreshing...", "info", 1000);
                  }}
                  className="underline text-purple-200 hover:text-purple-100 cursor-pointer text-sm"
                >
                  🔄 Click to refresh
                </button>
              </div>
            );
            showToast(toastContent, "error", 6000);
          } else {
            showToast(msg, "error", 5000);
          }

          setSubmitting(false);
          console.error("❌", msg);
        });
    } catch (err) {
      console.error("Booking status check failed", err);
      setSubmitting(false);
    }
  };

  const selectedFreelancerDate = DateTime.fromJSDate(selectedDate)
    .setZone(freelancerTimeZone)
    .toFormat("yyyy-MM-dd");

  // const filteredSlots = slots.filter((s) => s.day === selectedFreelancerDate);

  // Claude said to replace above with this
  const filteredSlots = slots.filter((s) =>
    isSlotOnDate(s, selectedDate, s.timezone || freelancerTimeZone)
  );

  console.log("🔍 Selected date:", selectedDate.toLocaleDateString());
  console.log("🔍 Filtered slots for this date:", filteredSlots.length);
  console.log(
    "🔍 Filtered slot details:",
    filteredSlots.map((s) => ({ day: s.day, time: s.time_24h, tz: s.timezone }))
  );

  // ⏱ Drop past unbooked slots, keep booked or inherited ones (shows popularity)
  const visibleSlots = filteredSlots.filter((slot) => {
    const isPast = isSlotInPast(slot, slot.timezone || freelancerTimeZone);

    // Hide only past + unbooked slots
    if (isPast && !slot.is_booked && !slot.is_inherited_block) {
      return false;
    }

    // ✅ KEEP booked + inherited slots visible for context
    return true;
  });

  // 🔥 NEW: Calculate which dates have available slots (for green highlighting)
  const availableDates = React.useMemo(() => {
    const dates = new Set();
    slots.forEach((slot) => {
      const slotTimezone = slot.timezone || freelancerTimeZone;
      const isPast = isSlotInPast(slot, slotTimezone);

      if (!isPast && !slot.is_booked && !slot.is_inherited_block) {
        // Convert UTC to local timezone to get correct date
        const utcDateTime = DateTime.fromFormat(
          `${slot.day} ${slot.time_24h}`,
          "yyyy-MM-dd HH:mm",
          { zone: "UTC" }
        );

        if (utcDateTime.isValid) {
          const localDate = utcDateTime
            .setZone(slotTimezone)
            .toFormat("yyyy-MM-dd");
          dates.add(localDate);
        }
      }
    });
    return Array.from(dates);
  }, [slots, freelancerTimeZone]);

  // 🚨 Handle missing freelancer BEFORE SafeLoader
  if (error === "missing-freelancer") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-base-200 rounded-lg shadow-xl p-8 text-center space-y-6">
          {/* Visual Element */}
          <div className="text-7xl animate-pulse">🔍</div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-purple-400">
            Hmm... we can't find this booking page
          </h1>

          {/* Explanation */}
          <p className="text-gray-400 text-sm leading-relaxed">
            This link doesn't belong to any freelancer. It might be broken,
            expired, or the freelancer may have deleted their account.
          </p>

          {/* CTA Button */}
          <button
            onClick={() => (window.location.href = "/")}
            className="btn btn-primary w-full mt-4"
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    );
  }

  // (Nothing here - auto-scroll removed, keeping fade-in animations)

  // 🚨 Handle missing freelancer BEFORE SafeLoader
  if (error === "missing-freelancer") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-base-200 rounded-lg shadow-xl p-8 text-center space-y-6">
          <div className="text-7xl animate-pulse">🔍</div>
          <h1 className="text-2xl font-bold text-purple-400">
            Hmm... we can't find this booking page
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            This link doesn't belong to any freelancer. It might be broken,
            expired, or the freelancer may have deleted their account.
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="btn btn-primary w-full mt-4"
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <SafeLoader loading={loading} error={error} onRetry={handleRetry}>
      <main className="max-w-md lg:max-w-2xl mx-auto p-6 space-y-6">
        {/* ✅ Return to Dashboard button - ONLY during step 6 onboarding */}
        {(() => {
          const isLoggedIn = localStorage.getItem("access_token");
          const onboardingStep6Visited = localStorage.getItem(
            "onboarding_step6_visited"
          );
          const onboardingCompleted = localStorage.getItem(
            "onboarding_completed"
          );
          const shouldShow =
            isLoggedIn && !onboardingStep6Visited && !onboardingCompleted;
          return (
            shouldShow && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => {
                    localStorage.setItem("onboarding_step6_visited", "true");
                    window.scrollTo({ top: 0, behavior: "instant" });
                    navigate("/freelancer-admin");
                  }}
                  className="btn btn-sm gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white border-none hover:from-purple-700 hover:to-blue-700 shadow-lg"
                >
                  ← Back to Dashboard to Continue Setup!
                </button>
              </div>
            )
          );
        })()}

        {/* ✅ FREELANCER CARD - ALWAYS VISIBLE */}
        <FreelancerCard
          business_name={freelancerDetails.business_name}
          first_name={freelancerDetails.first_name}
          last_name={freelancerDetails.last_name}
          logoUrl={freelancerDetails.logo_url}
          tagline={freelancerDetails.tagline}
          bio={freelancerDetails.bio}
          isVerified={freelancerDetails.is_verified}
          onClick={() => setShowModal(true)}
          tier={freelancerDetails.tier}
        />

        {showModal && (
          <FreelancerModal
            freelancer={{ ...freelancerDetails, id: freelancerId }}
            onClose={() => setShowModal(false)}
          />
        )}

        {/* ✅ BOOKING TITLE & REFRESH - ALWAYS VISIBLE */}
        <section className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-center">Book a Time Slot</h2>
          <RefreshButton
            onRefresh={handleRefresh}
            toastMessage="Refreshing booking page..."
            className="btn-sm"
          />
        </section>

        {/* ✅ BOOKING INSTRUCTIONS - ALWAYS VISIBLE IF EXISTS */}
        {freelancerDetails?.booking_instructions && (
          <BookingInstructionsCard
            instructions={freelancerDetails.booking_instructions}
          />
        )}

        {/* ✅ SERVICE CAROUSEL - ALWAYS VISIBLE */}
        {services.length > 0 && (
          <section className="mt-4">
            <h3 className="text-center text-lg font-bold text-white mb-2 mt-6">
              Choose Your Service
            </h3>
            <p className="text-center text-sm text-gray-400 mb-3 lg:hidden">
              ← Swipe to see more →
            </p>
            <div className="relative">
              {/* LEFT ARROW */}
              <button
                onClick={() => scrollCarousel("left")}
                disabled={!canScrollLeft}
                className={`
      hidden lg:flex
      absolute left-[-48px] top-1/2 -translate-y-1/2
      z-20
      w-10 h-10 rounded-full
      items-center justify-center
      transition-all duration-200
      ${
        canScrollLeft
          ? "bg-purple-900 hover:bg-purple-500 text-white shadow-lg hover:scale-110"
          : "bg-gray-700/50 text-gray-500 cursor-not-allowed opacity-50"
      }
    `}
                aria-label="Scroll left"
              >
                ←
              </button>

              {/* CAROUSEL */}
              <div
                ref={carouselRef}
                className="
      -mx-6
      px-6 py-4
      flex overflow-x-auto gap-4
      snap-x snap-mandatory lg:snap-none
      scrollbar-hide
      rounded-2xl
    "
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  background:
                    "linear-gradient(135deg, rgba(76, 29, 149, 0.25) 0%, rgba(59, 26, 107, 0.2) 15%, rgba(91, 33, 182, 0.3) 30%, rgba(76, 29, 149, 0.25) 50%, rgba(107, 33, 168, 0.35) 70%, rgba(88, 28, 135, 0.25) 85%, rgba(91, 33, 182, 0.3) 100%)",
                  borderTop: "1px solid rgba(107, 33, 168, 0.2)",
                  borderBottom: "1px solid rgba(107, 33, 168, 0.2)",
                  boxShadow:
                    "inset 0 1px 2px rgba(139, 92, 246, 0.15), inset 0 -1px 2px rgba(0, 0, 0, 0.2), 0 4px 10px rgba(107, 33, 168, 0.15)",
                }}
              >
                {services.map((service) => (
                  <div
                    key={service.id}
                    data-service-id={service.id}
                    className={`snap-center shrink-0 w-72 flex items-stretch transition-all rounded-xl
          bg-gradient-to-br from-white/5 to-white/0 shadow-lg shadow-black/20
          ${
            selectedServiceId === service.id
              ? "ring-2 ring-primary scale-[1.02]"
              : ""
          }`}
                  >
                    <ServiceCard
                      service={service}
                      isPublicView={true}
                      onClick={() => {
                        setSelectedServiceId(service.id);
                        setSelectedServiceDuration(service.duration_minutes);
                        scrollServiceIntoView(service.id);
                        setSelectedSlotId(null);
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* RIGHT ARROW */}
              <button
                onClick={() => scrollCarousel("right")}
                disabled={!canScrollRight}
                className={`
      hidden lg:flex
      absolute right-[-48px] top-1/2 -translate-y-1/2
      z-20
      w-10 h-10 rounded-full
      items-center justify-center
      transition-all duration-200
      ${
        canScrollRight
          ? "bg-purple-900 hover:bg-purple-500 text-white shadow-lg hover:scale-110"
          : "bg-gray-700/50 text-gray-500 cursor-not-allowed opacity-50"
      }
    `}
                aria-label="Scroll right"
              >
                →
              </button>
            </div>
          </section>
        )}

        {/* ✅ PROGRESSIVE REVEAL - HIDDEN UNTIL SERVICE SELECTED */}
        {selectedServiceId && (
          <div className="space-y-6 animate-slideInFromLeft">
            {/* ✅ ADD-ONS BUTTON (if addons exist) */}
            {addons.length > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowAddonModal(true)}
                  className="w-full max-w-sm flex items-center justify-center gap-2
                    px-4 py-3 rounded-xl
                    bg-gradient-to-r from-purple-500/20 to-blue-500/20
                    border border-purple-500/50
                    text-white font-medium
                    shadow-lg shadow-purple-700/20
                    hover:from-purple-500/30 hover:to-blue-500/30 hover:shadow-purple-600/30
                    transition-all duration-200 active:scale-[.98]"
                >
                  <span className="text-xl">🎁</span>
                  <span className="text-sm">
                    {selectedAddonIds.length > 0
                      ? `View Add-Ons (${selectedAddonIds.length} selected)`
                      : "Optional Add-Ons Available"}
                  </span>
                </button>
              </div>
            )}

            {/* ✅ BOOKING SUMMARY - CLEAN STYLING */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-md border border-slate-700">
              <h3 className="text-lg font-bold text-center mb-4 pb-3 border-b border-white/20 text-white">
                Booking Summary
              </h3>
              {(() => {
                const service = services.find(
                  (s) => s.id === selectedServiceId
                );
                const selectedAddons = addons.filter((a) =>
                  selectedAddonIds.includes(a.id)
                );
                const totalPrice =
                  (service?.price_usd || 0) +
                  selectedAddons.reduce((sum, a) => sum + a.price_usd, 0);
                const totalDuration =
                  (service?.duration_minutes || 0) +
                  selectedAddons.reduce(
                    (sum, a) => sum + a.duration_minutes,
                    0
                  );

                return (
                  <div className="space-y-3">
                    {/* Service */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">
                        {service?.name}
                      </span>
                      <span className="text-sm font-medium text-white">
                        ${service?.price_usd?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>Duration</span>
                      <span>{service?.duration_minutes} min</span>
                    </div>

                    {/* Add-ons */}
                    {selectedAddons.length > 0 && (
                      <>
                        <hr className="border-white/10 my-3" />
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                          Add-Ons:
                        </p>
                        {selectedAddons.map((addon) => (
                          <div key={addon.id} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-300">
                                {addon.name}
                              </span>
                              <span className="text-sm font-medium text-green-400">
                                +${addon.price_usd.toFixed(2)}
                              </span>
                            </div>
                            {addon.duration_minutes > 0 && (
                              <div className="flex justify-between items-center text-xs text-gray-400">
                                <span>Duration</span>
                                <span className="text-green-400">
                                  +{addon.duration_minutes} min
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {/* Total */}
                    <hr className="border-white/20 my-3" />
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-base font-bold text-white">
                        Total
                      </span>
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">
                          ${totalPrice.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {totalDuration} minutes
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ✅ DATE PICKER */}
            <section className="space-y-3">
              <h3 className="text-center text-lg font-bold text-white mt-6 mb-2">
                Pick a Date
              </h3>
              <label className="text-sm text-gray-400 block text-center">
                <span className="text-green-400 font-medium">
                  (Green = Slots Available)
                </span>
              </label>
              <IconDatePicker
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                minDate={new Date()}
                availableDates={availableDates}
              />
              <div className="flex justify-center w-full">
                <ReturnToTodayButton
                  onClick={() => setSelectedDate(new Date())}
                />
              </div>
            </section>

            {/* ✅ TIME SLOTS GRID */}
            {loading ? (
              <p className="text-center text-gray-400">Loading slots...</p>
            ) : (
              <section
                className="
      mt-6
      p-5
      rounded-2xl
      bg-gradient-to-br from-slate-800/80 via-slate-900/80 to-slate-950/80
      border border-slate-700
      shadow-md
    "
              >
                <h3 className="text-center text-lg font-bold text-white">
                  Choose Your Time
                </h3>

                <p className="text-center text-xs text-gray-400 mt-1 italic">
                  Times shown grouped by timezone below
                </p>

                {/* No available slots card */}
                {(() => {
                  const bookableSlots = visibleSlots.filter((slot) => {
                    const isPast = isSlotInPast(
                      slot,
                      slot.timezone || freelancerTimeZone
                    );
                    return (
                      !isPast && !slot.is_booked && !slot.is_inherited_block
                    );
                  });
                  const shouldShowCard =
                    filteredSlots.length === 0 || bookableSlots.length === 0;
                  const hasSlotsForDay = filteredSlots.length > 0;

                  return (
                    shouldShowCard && (
                      <NoAvailableSlotsCard
                        selectedDate={selectedDate}
                        hasSlotsForDay={hasSlotsForDay}
                        onRefresh={() => {
                          fetchSlots();
                          fetchFreelancerInfo();
                        }}
                      />
                    )
                  );
                })()}

                {/* Slots grid */}
                <div className="grid grid-cols-2 gap-4">
                  {(() => {
                    let lastTimezone = null;
                    return visibleSlots.map((slot) => {
                      const slotTimezone = slot.timezone || freelancerTimeZone;
                      const showHeader = slotTimezone !== lastTimezone;
                      lastTimezone = slotTimezone;

                      const isSelected = selectedSlotId === slot.id;
                      const isBlocked =
                        slot.is_booked || slot.is_inherited_block;
                      const isPast = isSlotInPast(slot, slotTimezone);
                      const isDisabled = isBlocked || isPast;

                      const handleSelectSlot = () => {
                        const selectedAddons = addons.filter((a) =>
                          selectedAddonIds.includes(a.id)
                        );
                        const totalAddonDuration = selectedAddons.reduce(
                          (sum, a) => sum + a.duration_minutes,
                          0
                        );
                        const totalDuration =
                          selectedServiceDuration + totalAddonDuration;
                        const requiredBlocks = getRequiredBlocks(totalDuration);

                        // 🔥 FIX: Only check consecutive slots within the SAME TIMEZONE
                        const slotTimezone =
                          slot.timezone || freelancerTimeZone;
                        const sameTzSlots = filteredSlots.filter(
                          (s) =>
                            (s.timezone || freelancerTimeZone) === slotTimezone
                        );

                        const actualIndex = sameTzSlots.findIndex(
                          (s) => s.id === slot.id
                        );
                        const futureSlots = sameTzSlots.slice(actualIndex);
                        const relevantSlice = futureSlots.slice(
                          0,
                          requiredBlocks
                        );
                        const visibleFree = relevantSlice.every(
                          (s) => !s.is_booked && !s.is_inherited_block
                        );
                        const startSlot = futureSlots[0];
                        if (
                          !startSlot ||
                          startSlot.is_booked ||
                          startSlot.is_inherited_block
                        ) {
                          showToast(
                            "Time overlaps with booking. Pick another slot.",
                            "error"
                          );
                          return;
                        }
                        if (!visibleFree) {
                          showToast(
                            "Time overlaps with booking. Pick another slot.",
                            "error"
                          );
                          return;
                        }
                        setSelectedSlotId((prev) =>
                          prev === slot.id ? null : slot.id
                        );
                      };

                      return (
                        <React.Fragment key={`slot-${slot.id}`}>
                          {showHeader && (
                            <div className="col-span-2 mt-4 mb-3 text-center w-full">
                              <div className="inline-block px-4 py-2 rounded-lg bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 shadow-md">
                                <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                                  {slotTimezone === "America/New_York"
                                    ? "Eastern"
                                    : slotTimezone === "America/Chicago"
                                    ? "Central"
                                    : slotTimezone === "America/Denver"
                                    ? "Mountain"
                                    : slotTimezone === "America/Los_Angeles"
                                    ? "Pacific"
                                    : slotTimezone
                                        .replace("America/", "")
                                        .replace("_", " ")}{" "}
                                  Timezone
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col">
                            <button
                              className={`btn w-full text-sm lg:text-base lg:p-5 transition-all duration-200 ${
                                isDisabled
                                  ? "bg-gray-800 text-gray-500 cursor-not-allowed opacity-60"
                                  : isSelected
                                  ? "bg-primary text-white ring-2 ring-primary/40 shadow-lg shadow-primary/20 scale-[1.02]"
                                  : `
  bg-slate-800/70
  border border-slate-600/60
  text-white
  shadow-md shadow-black/25
  hover:bg-slate-700/80
  hover:border-primary/60
  hover:shadow-lg hover:shadow-primary/20
  hover:scale-[1.03]
`
                              }`}
                              onClick={() => {
                                if (loading || isDisabled) return;
                                handleSelectSlot();
                              }}
                              type="button"
                            >
                              {(() => {
                                const { formattedTime, abbreviation } =
                                  formatSlotTimeParts(slot, slotTimezone);
                                return (
                                  <span className="text-xs w-full text-center flex justify-center items-center gap-1">
                                    <span>{formattedTime}</span>
                                    <span className="text-[0.65rem] text-gray-400">
                                      {abbreviation}
                                    </span>
                                  </span>
                                );
                              })()}
                            </button>

                            {slot.is_booked && (
                              <div className="text-xs text-red-400 mt-1 text-center">
                                {slot.service_name ? (
                                  <>
                                    Booked: <strong>{slot.service_name}</strong>{" "}
                                    ({slot.duration_minutes} min)
                                  </>
                                ) : (
                                  <>Booked</>
                                )}
                              </div>
                            )}

                            {slot.is_inherited_block && (
                              <div className="text-xs text-purple-400 mt-1 text-center italic">
                                Blocked (part of earlier appointment)
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ✅ CONTACT FORM - HIDDEN UNTIL SLOT SELECTED */}
        {selectedSlotId && (
          <section className="animate-slideInFromLeft">
            <div className="p-5 rounded-2xl mt-10 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-md border border-slate-700">
              <form onSubmit={handleSubmit} className="space-y-4">
                {cooldownRemaining > 0 && (
                  <p className="text-center text-yellow-400 text-sm mb-2">
                    ⏳ You can book again in {cooldownRemaining} seconds.
                  </p>
                )}

                <h3 className="text-lg font-semibold text-center border-b border-white/20 pb-2">
                  Enter Your Contact Info
                </h3>

                <input
                  type="text"
                  placeholder="First name"
                  className="input input-bordered w-full"
                  value={firstName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFirstName(
                      val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
                    );
                  }}
                  required
                />

                <input
                  type="text"
                  placeholder="Last name"
                  className="input input-bordered w-full"
                  value={lastName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLastName(
                      val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
                    );
                  }}
                  required
                />

                <input
                  type="email"
                  placeholder="Your email"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  required
                />

                <input
                  type="tel"
                  placeholder="Your phone"
                  className="input input-bordered w-full"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />

                {/* Custom Questions */}
                {customQuestions.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <h3 className="text-sm font-semibold text-center text-white">
                      Additional Questions
                    </h3>
                    {customQuestions.map((q, i) => (
                      <div key={i}>
                        <label className="block text-sm font-medium text-white mb-1">
                          {q.question}
                          {q.required && (
                            <span className="text-red-500"> *</span>
                          )}
                        </label>
                        <input
                          type="text"
                          className="input input-bordered w-full"
                          value={customResponses[q.question] || ""}
                          onChange={(e) =>
                            setCustomResponses({
                              ...customResponses,
                              [q.question]: e.target.value,
                            })
                          }
                          required={q.required}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <HoneypotInput value={honeypot} setValue={setHoneypot} />

                <button
                  className={`btn w-full flex items-center justify-center gap-2 ${
                    submitting || !selectedSlotId
                      ? "opacity-50 cursor-not-allowed btn-primary"
                      : cooldownRemaining > 0
                      ? "btn-outline text-white border-yellow-500"
                      : "btn-primary"
                  }`}
                  disabled={!selectedSlotId || submitting}
                  type="submit"
                >
                  {submitting && (
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white border-opacity-60"></span>
                  )}
                  {submitting
                    ? "Submitting..."
                    : cooldownRemaining > 0
                    ? `Please wait (${cooldownRemaining}s)`
                    : "Book Appointment"}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* ✅ Divider BEFORE Policy Section */}
        <div
          className="-mx-6 my-10 h-[2px]
  bg-gradient-to-r
  from-transparent via-primary/40 to-transparent
"
        ></div>

        {/* ✅ NO-SHOW POLICY & FAQ - GROUPED TOGETHER */}
        <NoShowPolicy policy={noShowPolicy} />
        <FAQCard faq_items={freelancerDetails.faq_items} />
      </main>

      {/* ✅ Add-On Selection Modal */}
      <AddonSelectionModal
        open={showAddonModal}
        onClose={() => setShowAddonModal(false)}
        addons={addons}
        selectedAddonIds={selectedAddonIds}
        onUpdateSelection={(newIds) => {
          setSelectedAddonIds(newIds);
          setSelectedSlotId(null);
        }}
      />
    </SafeLoader>
  );
}
