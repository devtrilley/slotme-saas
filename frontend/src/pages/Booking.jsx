import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { DateTime } from "luxon";

import "react-datepicker/dist/react-datepicker.css";
import FreelancerCard from "../components/Cards/FreelancerCard";
import FreelancerModal from "../components/Modals/FreelancerModal";
import NoShowPolicy from "../components/NoShowPolicy";
import FAQCard from "../components/Cards/FAQCard";
import IconDatePicker from "../components/Inputs/IconDatePicker";
import { showToast } from "../utils/toast";
import ServiceCard from "../components/Cards/ServiceCard";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/constants";
import HoneypotInput from "../components/Inputs/HoneypotInput";
import SafeLoader from "../components/Layout/SafeLoader";
import NoAvailableSlotsCard from "../components/Cards/NoAvailableSlotsCard";
import RefreshButton from "../components/Buttons/RefreshButton";
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedServiceDuration, setSelectedServiceDuration] = useState(0);
  const [noShowPolicy, setNoShowPolicy] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [honeypot, setHoneypot] = useState(""); // Test honeypot by changing default value
  const [submitting, setSubmitting] = useState(false);
  const [bookingStatus, setBookingStatus] = useState(null);
  // null = unknown, "pending", "confirmed", "none"

  const [customQuestions, setCustomQuestions] = useState([]);
  const [customResponses, setCustomResponses] = useState({});

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

  const sortSlots = (slots) => {
    return [...slots].sort((a, b) => {
      const timezoneA = a.timezone || freelancerTimeZone;
      const timezoneB = b.timezone || freelancerTimeZone;

      // 🔥 FIRST: Group by timezone (alphabetical)
      if (timezoneA !== timezoneB) {
        return timezoneA.localeCompare(timezoneB);
      }

      // 🔥 SECOND: Within same timezone, sort by time
      const timeA = DateTime.fromFormat(a.time, "hh:mm a");
      const timeB = DateTime.fromFormat(b.time, "hh:mm a");
      return timeA.toMillis() - timeB.toMillis();
    });
  };

  const handleRetry = () => {
    setError("");
    setLoading(true);
    fetchFreelancerInfo();
    fetchSlots();
  };

  const handleRefresh = async () => {
    showToast("Refreshing slots...", "refresh", 2000);
    try {
      const [slotsRes, infoRes] = await Promise.all([
        axios.get(`${API_BASE}/freelancer/slots/${freelancerId}`),
        axios.get(`${API_BASE}/freelancer/public-info/${freelancerId}`),
      ]);
      setSlots(sortSlots(slotsRes.data));
      const data = infoRes.data;
      setFreelancerDetails({
        ...data,
        tier: data.tier?.toLowerCase() || "free",
      });
      setFreelancerTimeZone(data.timezone || "America/New_York");
      setNoShowPolicy(data.no_show_policy || "");

      const enabled = data.services || [];
      setServices(enabled);

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
        showToast("✅ Confirmation email sent.", "success");
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Resend failed.";

        if (msg.includes("already cancelled")) {
          showToast(
            "This appointment was already cancelled. Please refresh and book again.",
            "warning",
            3000
          );
        } else if (msg.includes("already confirmed")) {
          showToast(
            "This appointment is already confirmed. No further action needed.",
            "info",
            3000
          );
        } else {
          showToast(msg, "error", 3000);
        }
      })
      .finally(() => setResendLoading(false));
  };

  useEffect(() => {
    fetchSlots();
    fetchFreelancerInfo();

    const params = new URLSearchParams(window.location.search);
    if (params.get("cancelled") === "true") {
      showToast("✅ Your booking was cancelled.", "success");
      fetchSlots();
      setBookingStatus("none");
    }

    const interval = setInterval(() => {
      const lastBookingTime = localStorage.getItem("last_booking_time");
      if (lastBookingTime) {
        const elapsed = Date.now() - lastBookingTime;
        // const remaining = Math.max(0, 120000 - elapsed); // 120000ms = 2 minutes, 120 seconds
        const remaining = Math.max(0, 20000 - elapsed); // 20 second cooldown
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
      setSlots(sortSlots(res.data));
    } catch (err) {
      console.error("❌ Failed to fetch slots", err);
      setError("Booking page unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate(); // ⬅ place this inside BookingPage()

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !selectedSlotId) return;
    setSubmitting(true);

    const res = await axios.get(`${API_BASE}/freelancer/slots/${freelancerId}`);
    const sorted = sortSlots(res.data);

    const latestSlot = sorted.find((s) => s.id === selectedSlotId);
    if (!latestSlot || latestSlot.is_booked || latestSlot.is_inherited_block) {
      showToast(
        "❌ That slot is no longer available. Please refresh.",
        "error"
      );
      setSelectedSlotId(null);
      setSubmitting(false);
      return;
    }

    const lastBookingTime = localStorage.getItem("last_booking_time");
    const now = Date.now();

    // Testing, switch between 20 seconds and 120 seconds (2 min)
    if (lastBookingTime && now - lastBookingTime < 20 * 1000) {
      showToast("⏳ Please wait before booking again.", "error");
      setSubmitting(false);
      return;
    }

    const emailRegex = /^[A-Za-z0-9]+[\w.-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      showToast("❌ Please enter a valid email address.", "error");
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
          setCooldownRemaining(90);
          showToast("📨 Booking successful, updating slots...", "info", 1500);
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

          if (msg.includes("already have a booking")) {
            const appointmentId = err.response?.data?.appointment_id;
            const extractedId = !appointmentId && msg?.match(/ID: (\d+)/)?.[1];
            const safeAppointmentId = appointmentId || extractedId;

            // ✅ Use React JSX instead of createElement
            const toastContent = (
              <div>
                <p
                  style={{
                    fontWeight: "bold",
                    fontSize: "0.95rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  You're already booked with this freelancer! You'll need to
                  cancel first.
                </p>

                {status === "pending" && safeAppointmentId && (
                  <button
                    className="underline text-purple-800 cursor-pointer text-sm"
                    disabled={resendLoading}
                    onClick={() => resendConfirmation(safeAppointmentId)}
                  >
                    Resend confirmation email
                  </button>
                )}

                {status === "confirmed" && (
                  <p className="text-white text-sm mt-1">
                    This appointment is already confirmed. You're good to go!
                  </p>
                )}

                {status !== "pending" && status !== "confirmed" && (
                  <p className="text-yellow-400 text-sm mt-1">
                    Status unknown — please check your email.
                  </p>
                )}
              </div>
            );

            showToast(toastContent, "error", 8000);
          } else {
            showToast(msg, "error");
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
    isSlotOnDate(s, selectedDate, freelancerTimeZone)
  );

  // ⏱ Drop past unbooked slots, keep booked or inherited ones (shows popularity)
  const visibleSlots = filteredSlots.filter((slot) => {
    const isPast = isSlotInPast(slot, freelancerTimeZone);

    if (isPast && !slot.is_booked && !slot.is_inherited_block) {
      return false;
    }

    return true;
  });

  console.log("Selected Date:", selectedDate);
  console.log(
    "Parsed Luxon Date:",
    DateTime.fromJSDate(selectedDate).toISODate()
  );

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
      <div className="max-w-md mx-auto p-6 space-y-6">
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
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-center">Book a Time Slot</h2>
          <RefreshButton
            onRefresh={handleRefresh}
            toastMessage="Refreshing booking page..."
            className="btn-sm"
          />
        </div>
        {freelancerDetails?.booking_instructions && (
          <div className="mb-4">
            <BookingInstructionsCard
              instructions={freelancerDetails.booking_instructions}
            />
          </div>
        )}
        {services.length > 0 && (
          <div className="mt-4">
            <h3 className="text-center text-sm text-white mb-2 font-medium">
              Available Services
            </h3>
            <div className="flex overflow-x-auto gap-4 px-5 py-4 snap-x snap-mandatory rounded-xl bg-white/5">
              {services.map((service) => (
                <div key={service.id} className="snap-start shrink-0 w-72">
                  <ServiceCard
                    service={service}
                    isPublicView={true}
                    onClick={() => {
                      setSelectedServiceId(service.id);
                      setSelectedServiceDuration(service.duration_minutes);

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
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm text-gray-400 block text-center">
            Select a date:
          </label>
          <IconDatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            minDate={new Date()} // ✅ prevents selecting yesterday
          />

          {services.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm text-gray-400 block text-center">
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
            </div>
          )}

          {/* 🧭 Dynamic timezone label */}
          {(() => {
            // Collect unique timezones from visible slots
            const uniqueZones = [
              ...new Set(
                visibleSlots.map((s) => s.timezone || freelancerTimeZone)
              ),
            ];

            // If more than one timezone, show plural message
            if (uniqueZones.length > 1) {
              return (
                <p className="text-sm text-gray-400 text-center mt-2 italic">
                  *Slots shown in each freelancer timezone (e.g.{" "}
                  {uniqueZones.map((z, i) => (
                    <span key={z}>
                      {getTimezoneAbbreviation(z)}
                      {i < uniqueZones.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  )*
                </p>
              );
            }

            // Otherwise, single timezone
            const tz = uniqueZones[0];
            return (
              <p className="text-sm text-gray-400 text-center mt-2 italic">
                *All times shown in {getTimezoneFullName(tz)}{" "}
                <span className="text-gray-500">
                  ({getTimezoneAbbreviation(tz)})
                </span>
                *
              </p>
            );
          })()}
        </div>
        {loading ? (
          <p className="text-center">Loading slots...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
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
                    const requiredBlocks = getRequiredBlocks(
                      selectedServiceDuration
                    );
                    const futureSlots = filteredSlots.slice(index);

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
                        "❌ That time overlaps with an existing booking. Try a different time slot.",
                        "error"
                      );
                      return;
                    }

                    if (!visibleFree) {
                      showToast(
                        "❌ That time overlaps with an existing booking. Try a different time slot.",
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
                    <>
                      {/* 🔥 Timezone group header - spans full width */}
                      {showHeader && (
                        <div className="col-span-2 mt-4 mb-2 text-center">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {slotTimezone.replace("America/", "")} Timezone
                          </span>
                        </div>
                      )}

                      <div key={slot.id} className="flex flex-col">
                        <button
                          className={`btn w-full text-sm ${
                            isDisabled
                              ? "bg-gray-800 text-gray-500 cursor-not-allowed opacity-60"
                              : isSelected
                              ? "btn-primary text-white"
                              : "btn-outline text-white border-white"
                          }`}
                          onClick={() => {
                            if (loading) return;

                            if (!selectedServiceId) {
                              showToast(
                                "❌ Please select a service first.",
                                "error"
                              );
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
                                  "⚠️ This is a past date. Please choose another day.",
                                  "warning"
                                );
                              } else {
                                showToast(
                                  "⏳ This time has already passed.",
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
                              formatSlotTimeParts(slot, freelancerTimeZone);
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
                    </>
                  );
                });
              })()}
            </div>

            {!loading && filteredSlots.length === 0 && (
              <NoAvailableSlotsCard
                selectedDate={selectedDate}
                onRefresh={() => {
                  fetchSlots();
                  fetchFreelancerInfo();
                }}
              />
            )}
          </>
        )}
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
            onChange={(e) => setFirstName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Last name"
            className="input input-bordered w-full"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
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
        <NoShowPolicy policy={noShowPolicy} />
        <FAQCard faq_items={freelancerDetails.faq_items} />{" "}
      </div>
    </SafeLoader>
  );
}
