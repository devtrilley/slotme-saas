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
      setSlots(res.data); // 🔥 REMOVED sortSlots() - backend already sorted!
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

  // ⏱ Drop past unbooked slots, keep booked or inherited ones (shows popularity)
  const visibleSlots = filteredSlots.filter((slot) => {
    const isPast = isSlotInPast(slot, slot.timezone || freelancerTimeZone);
    if (isPast && !slot.is_booked && !slot.is_inherited_block) {
      return false;
    }
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

          // Only show if: logged in AND step 6 NOT visited yet AND onboarding NOT complete
          const shouldShow =
            isLoggedIn && !onboardingStep6Visited && !onboardingCompleted;

          return (
            shouldShow && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => {
                    // Mark step 6 complete
                    localStorage.setItem("onboarding_step6_visited", "true");

                    // Scroll to top before navigating
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
        <section className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-center">Book a Time Slot</h2>
          <RefreshButton
            onRefresh={handleRefresh}
            toastMessage="Refreshing booking page..."
            className="btn-sm"
          />
        </section>
        {freelancerDetails?.booking_instructions && (
          <div className="mb-4">
            <BookingInstructionsCard
              instructions={freelancerDetails.booking_instructions}
            />
          </div>
        )}
        {services.length > 0 && (
          <section className="mt-4">
            <h3 className="text-center text-sm text-white mb-2 mt-6 font-medium">
              Available Services Slider
            </h3>

            {/* ✅ No gap - buttons touch carousel */}
            <div className="flex items-stretch">
              {/* ✅ Left arrow - rounds left edge */}
              <button
                onClick={() => scrollCarousel("left")}
                disabled={!canScrollLeft}
                className={`hidden lg:flex items-center justify-center w-12 rounded-l-xl transition-all ${
                  canScrollLeft
                    ? "bg-white/10 hover:bg-white/15 border-l border-t border-b border-white/20 text-white"
                    : "bg-white/5 border-l border-t border-b border-white/10 text-gray-600 cursor-not-allowed"
                }`}
                aria-label="Scroll left"
              >
                <span className="text-2xl">←</span>
              </button>

              {/* ✅ Carousel - sharp corners */}
              <div
                ref={carouselRef}
                className="flex-1 flex overflow-x-auto gap-4 px-5 py-4 snap-x snap-mandatory lg:snap-none bg-white/5 border-t border-b border-white/10 scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
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

                        const requiredBlocks = getRequiredBlocks(
                          service.duration_minutes
                        );
                        const index = filteredSlots.findIndex(
                          (s) => s.id === selectedSlotId
                        );
                        if (index === -1) {
                          setSelectedSlotId(null);
                          return;
                        }
                        const futureSlots = filteredSlots.slice(index);
                        const relevantSlice = futureSlots.slice(
                          0,
                          requiredBlocks
                        );
                        const visibleFree = relevantSlice.every(
                          (s) => !s.is_booked && !s.is_inherited_block
                        );
                        const missingBlocks =
                          requiredBlocks - relevantSlice.length;
                        const startSlot = futureSlots[0];
                        const lastSlotId =
                          filteredSlots[filteredSlots.length - 1]?.id;
                        const isLastSlot = startSlot?.id === lastSlotId;
                        const valid =
                          visibleFree && (missingBlocks <= 0 || isLastSlot);
                        if (!valid) setSelectedSlotId(null);
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* ✅ Right arrow - rounds right edge */}
              <button
                onClick={() => scrollCarousel("right")}
                disabled={!canScrollRight}
                className={`hidden lg:flex items-center justify-center w-12 rounded-r-xl transition-all ${
                  canScrollRight
                    ? "bg-white/10 hover:bg-white/15 border-r border-t border-b border-white/20 text-white"
                    : "bg-white/5 border-r border-t border-b border-white/10 text-gray-600 cursor-not-allowed"
                }`}
                aria-label="Scroll right"
              >
                <span className="text-2xl">→</span>
              </button>
            </div>
          </section>
        )}
        {/* ✅ ADD-ONS BUTTON - RIGHT AFTER CAROUSEL */}
        {selectedServiceId && addons.length > 0 && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowAddonModal(true)}
              className="w-full max-w-sm flex items-center justify-center gap-2
        px-4 py-3 rounded-lg
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
                  : "Click to View Available Add-Ons"}
              </span>
            </button>
          </div>
        )}
        <section className="space-y-2">
          <label className="text-sm text-gray-400 block text-center mt-6">
            Select a date:
            <br />
            <span className="text-green-400 text-xs">
              (Green = Slots Available)
            </span>
          </label>
          <IconDatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            minDate={new Date()} // ✅ prevents selecting yesterday
            availableDates={availableDates}
          />
          {/* 🔥 NEW: Return to Today button */}
          <div className="flex justify-center w-full">
            <ReturnToTodayButton onClick={() => setSelectedDate(new Date())} />
          </div>

          {services.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm text-gray-400 block text-center mt-6">
                Select a service:
              </label>
              <div
                id="service-select-wrapper"
                className="relative transition-all duration-300 rounded-lg overflow-hidden"
              >
                <select
                  className="select select-bordered w-full rounded-lg"
                  value={selectedServiceId || ""}
                  onChange={(e) => {
                    const serviceId = Number(e.target.value);
                    setSelectedServiceId(serviceId);
                    const selectedService = services.find(
                      (s) => s.id === serviceId
                    );
                    const newDuration = selectedService?.duration_minutes || 0;
                    setSelectedServiceDuration(newDuration);

                    // Recalculate slot logic
                    const requiredBlocks = getRequiredBlocks(newDuration);
                    const index = filteredSlots.findIndex(
                      (s) => s.id === selectedSlotId
                    );

                    if (index === -1) {
                      setSelectedSlotId(null);
                      return;
                    }

                    const futureSlots = filteredSlots.slice(index);
                    const relevantSlice = futureSlots.slice(0, requiredBlocks);

                    const visibleFree = relevantSlice.every(
                      (s) => !s.is_booked && !s.is_inherited_block
                    );

                    const missingBlocks = requiredBlocks - relevantSlice.length;
                    const startSlot = futureSlots[0];
                    const lastSlotId =
                      filteredSlots[filteredSlots.length - 1]?.id;
                    const isLastSlot = startSlot?.id === lastSlotId;

                    const valid =
                      visibleFree && (missingBlocks <= 0 || isLastSlot);

                    if (!valid) setSelectedSlotId(null);
                  }}
                  required
                >
                  <option value="" disabled>
                    -- Choose a service --
                  </option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min) - $
                      {s.price_usd?.toFixed(2) || "0.00"}
                    </option>
                  ))}
                </select>
              </div>
              {/* ✅ DUAL ADD-ONS ACCESS - ALSO UNDER DROPDOWN */}
              {selectedServiceId && addons.length > 0 && (
                <button
                  onClick={() => setShowAddonModal(true)}
                  className="w-full mt-2 flex items-center justify-center gap-2
          px-3 py-2 rounded-lg
          bg-gradient-to-r from-purple-500/10 to-blue-500/10
          border border-purple-500/30
          text-white text-sm
          hover:from-purple-500/20 hover:to-blue-500/20
          transition-all duration-200"
                >
                  <span>🎁</span>
                  <span>
                    {selectedAddonIds.length > 0
                      ? `Add-Ons (${selectedAddonIds.length})`
                      : "Click Here for Add-On Services"}
                  </span>
                </button>
              )}
              {/* ✅ Total Price & Duration Display */}
              {selectedServiceId && (
                <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-sm font-medium text-center mb-3 border-b border-white/10 pb-2">
                    Booking Summary
                  </p>
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
                      <div className="space-y-2">
                        {/* Service */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-300">
                            {service?.name}
                          </span>
                          <span className="text-sm text-white">
                            ${service?.price_usd?.toFixed(2) || "0.00"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>Duration</span>
                          <span>{service?.duration_minutes} min</span>
                        </div>

                        {/* Add-ons */}
                        {selectedAddons.length > 0 && (
                          <>
                            <hr className="border-white/10 my-2" />
                            <p className="text-xs text-gray-400 font-medium">
                              Add-Ons:
                            </p>
                            {selectedAddons.map((addon) => (
                              <div key={addon.id} className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-300">
                                    {addon.name}
                                  </span>
                                  <span className="text-sm text-green-400">
                                    +${addon.price_usd.toFixed(2)}
                                  </span>
                                </div>
                                {addon.duration_minutes > 0 && (
                                  <div className="flex justify-between items-center text-xs text-gray-500">
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
                        <hr className="border-white/20 my-2" />
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-base font-bold text-white">
                            Total
                          </span>
                          <div className="text-right">
                            <p className="text-lg font-bold text-white">
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
              )}
            </div>
          )}

          {/* 🧭 Simplified timezone note */}
          <p className="text-sm text-gray-400 text-center mt-2 italic">
            *Times grouped by timezone below*
          </p>
        </section>
        {loading ? (
          <p className="text-center">Loading slots...</p>
        ) : (
          <>
            {/* ✅ No-available-slots card ABOVE the grid */}
            {(() => {
              const bookableSlots = visibleSlots.filter((slot) => {
                const isPast = isSlotInPast(
                  slot,
                  slot.timezone || freelancerTimeZone
                ); // 🔥 Use slot's own timezone
                return !isPast && !slot.is_booked && !slot.is_inherited_block;
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
            <section className="grid grid-cols-2 gap-4">
              {(() => {
                let lastTimezone = null;

                return visibleSlots.map((slot, index) => {
                  const slotTimezone = slot.timezone || freelancerTimeZone;
                  const showHeader = slotTimezone !== lastTimezone;

                  lastTimezone = slotTimezone;

                  const isSelected = selectedSlotId === slot.id;
                  const isBlocked =
                    slot.is_booked ||
                    slot.is_inherited_block ||
                    !selectedServiceId;

                  const isPast = isSlotInPast(slot, freelancerTimeZone);
                  const isDisabled = isBlocked || isPast;

                  const handleSelectSlot = () => {
                    // ✅ Calculate total duration including add-ons
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
                    // 🔥 FIX: Find actual index in filteredSlots
                    const actualIndex = filteredSlots.findIndex(
                      (s) => s.id === slot.id
                    );
                    const futureSlots = filteredSlots.slice(actualIndex);

                    const relevantSlice = futureSlots.slice(0, requiredBlocks);

                    const visibleFree = relevantSlice.every(
                      (s) => !s.is_booked && !s.is_inherited_block
                    );

                    const slotsExist = relevantSlice.length;
                    const missingSlots = requiredBlocks - slotsExist;

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

                    if (missingSlots > 0 && !isSelected) {
                      console.warn(
                        "⚠️ Booking extends beyond visible slots – inherited blocks will apply server-side."
                      );
                    }

                    setSelectedSlotId((prev) =>
                      prev === slot.id ? null : slot.id
                    );
                  };

                  return (
                    <React.Fragment key={`slot-${slot.id}`}>
                      {/* 🔥 Timezone group header - spans full width */}
                      {showHeader && (
                        <div className="col-span-2 mt-4 mb-2 text-center w-full">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                      )}
                      <div className="flex flex-col">
                        <button
                          className={`btn w-full text-sm lg:text-base lg:p-5 animate-fadeInFast ${
                            isDisabled
                              ? "bg-gray-800 text-gray-500 cursor-not-allowed opacity-60"
                              : isSelected
                              ? "bg-primary text-white ring-2 ring-primary/40 shadow-lg shadow-primary/20 scale-[1.02]"
                              : "btn-outline text-white border-white"
                          }`}
                          onClick={() => {
                            if (loading) return;
                            if (!selectedServiceId) {
                              showToast("Select a service first.", "warning");
                              return;
                            }
                            if (isDisabled) {
                              const nowInFreelancerTZ = DateTime.now()
                                .setZone(freelancerTimeZone)
                                .startOf("day");
                              const selectedEST =
                                DateTime.fromJSDate(selectedDate).startOf(
                                  "day"
                                );
                              if (selectedEST < nowInFreelancerTZ) {
                                showToast(
                                  "Past date. Choose another day.",
                                  "warning"
                                );
                              } else {
                                showToast(
                                  "Time already passed. Pick another.",
                                  "warning"
                                );
                              }
                              return;
                            }
                            handleSelectSlot();
                          }}
                          type="button"
                        >
                          {(() => {
                            const { formattedTime, abbreviation } =
                              formatSlotTimeParts(
                                slot,
                                slot.timezone || freelancerTimeZone
                              );
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
                                Booked: <strong>{slot.service_name}</strong> (
                                {slot.duration_minutes} min)
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
            </section>
          </>
        )}
        <section>
          <form onSubmit={handleSubmit} className="space-y-4">
            {cooldownRemaining > 0 && (
              <p className="text-center text-yellow-400 text-sm mb-2">
                ⏳ You can book again in {cooldownRemaining} seconds.
              </p>
            )}

            <h3 className="text-lg font-semibold text-center border-b pb-1">
              Your Name & Contact Info
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

            {/* ✅ CUSTOM QUESTIONS SECTION */}
            {customQuestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-center border-b pb-1">
                  Additional Questions
                </h3>

                {customQuestions.map((q, i) => (
                  <div key={i}>
                    <label className="block text-sm font-medium text-white mb-1">
                      {q.question}
                      {q.required && <span className="text-red-500"> *</span>}
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
        </section>
        <NoShowPolicy policy={noShowPolicy} />
        <FAQCard faq_items={freelancerDetails.faq_items} />{" "}
      </main>

      {/* ✅ Add-On Selection Modal */}
      <AddonSelectionModal
        open={showAddonModal}
        onClose={() => setShowAddonModal(false)}
        addons={addons}
        selectedAddonIds={selectedAddonIds}
        onUpdateSelection={(newIds) => {
          setSelectedAddonIds(newIds);
          setSelectedSlotId(null); // Reset slot when add-ons change
        }}
      />
    </SafeLoader>
  );
}
