import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { DateTime } from "luxon";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import FreelancerCard from "../components/FreelancerCard";
import FreelancerModal from "../components/FreelancerModal";
import NoShowPolicy from "../components/NoShowPolicy";
import FAQCard from "../components/FAQCard";
import IconDatePicker from "../components/IconDatePicker";
import { showToast } from "../utils/toast";
import ServiceCard from "../components/ServiceCard";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/constants";
import HoneypotInput from "../components/HoneypotInput";

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
  const [branding, setBranding] = useState({
    first_name: "",
    last_name: "",
    business_name: "",
    logo_url: "",
    tagline: "",
    bio: "",
    is_verified: false,
    faq_text: "",
  });
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

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const getRequiredBlocks = (durationMinutes) =>
    Math.ceil(durationMinutes / 15);

  const getTZAbbreviation = (tz) => {
    const map = {
      "America/New_York": "EST",
      "America/Detroit": "EST",
      "America/Chicago": "CST",
      "America/Denver": "MST",
      "America/Phoenix": "MST",
      "America/Los_Angeles": "PST",
      "America/Anchorage": "AKST",
      "America/Adak": "HST",
    };
    return map[tz] || "Local";
  };

  const parseTimeToDate = (timeStr) => {
    const [h, m] = timeStr.split(/[: ]/);
    let hour = parseInt(h),
      minute = parseInt(m);
    if (timeStr.includes("PM") && hour !== 12) hour += 12;
    if (timeStr.includes("AM") && hour === 12) hour = 0;
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const sortSlots = (slots) => {
    return [...slots].sort((a, b) => {
      return parseTimeToDate(a.time) - parseTimeToDate(b.time);
    });
  };

  const fetchFreelancerInfo = () => {
    axios
      .get(`${API_BASE}/freelancer/public-info/${freelancerId}`)
      .then((res) => {
        setBranding({ ...res.data });
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
            const wrapper = document.createElement("div");
            const text1 = document.createElement("p");
            text1.textContent =
              "You're already booked with this freelancer! You'll need to cancel first.";
            text1.style.fontWeight = "bold";
            text1.style.fontSize = "0.95rem";
            text1.style.marginBottom = "0.5rem";
            wrapper.appendChild(text1);

            const appointmentId = err.response?.data?.appointment_id;
            const extractedId = !appointmentId && msg?.match(/ID: (\d+)/)?.[1];
            const safeAppointmentId = appointmentId || extractedId;

            if (status === "pending" && safeAppointmentId) {
              const resendBtn = document.createElement("button");
              resendBtn.textContent = "Resend confirmation email";
              resendBtn.className =
                "underline text-purple-800 cursor-pointer text-sm";
              resendBtn.disabled = resendLoading;
              resendBtn.onclick = () => resendConfirmation(safeAppointmentId);
              wrapper.appendChild(resendBtn);
            } else if (status === "confirmed") {
              const msgElem = document.createElement("p");
              msgElem.textContent =
                "This appointment is already confirmed. You're good to go!";
              msgElem.className = "text-white text-sm mt-1";
              wrapper.appendChild(msgElem);
            } else {
              const fallback = document.createElement("p");
              fallback.textContent =
                "Status unknown — please check your email.";
              fallback.className = "text-yellow-400 text-sm mt-1";
              wrapper.appendChild(fallback);
            }

            showToast(wrapper, "error", 8000);
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

  const convertToUserTime = (time, sourceTZ, userTZ) => {
    const [label, meridian] = time.split(" ");
    let [hour, minute] = label.split(":").map(Number);
    if (meridian === "PM" && hour !== 12) hour += 12;
    if (meridian === "AM" && hour === 12) hour = 0;

    const dateInSourceTZ = DateTime.fromObject(
      { hour, minute },
      { zone: sourceTZ }
    );

    return dateInSourceTZ.setZone(userTZ).toLocaleString(DateTime.TIME_SIMPLE);
  };

  const selectedESTDate = DateTime.fromJSDate(selectedDate)
    .setZone("America/New_York")
    .toFormat("yyyy-MM-dd");

  const filteredSlots = slots.filter((s) => s.day === selectedESTDate);

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <FreelancerCard
        business_name={branding.business_name}
        first_name={branding.first_name}
        last_name={branding.last_name}
        logoUrl={branding.logo_url}
        tagline={branding.tagline}
        bio={branding.bio}
        isVerified={branding.is_verified}
        onClick={() => setShowModal(true)}
      />

      {showModal && (
        <FreelancerModal
          freelancer={{ ...branding, id: freelancerId }}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-bold text-center">Book a Time Slot</h2>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => {
            fetchSlots();
            fetchFreelancerInfo(); // ✅ add this
          }}
          disabled={loading}
        >
          🔁 Refresh
        </button>
      </div>

      {freelancerTimeZone && (
        <p className="text-sm text-gray-400 text-center mt-1 italic">
          *All times shown in {getTZAbbreviation(freelancerTimeZone)}*
        </p>
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
        />

        {services.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm text-gray-400 block text-center">
              Select a service:
            </label>
            <select
              className="select select-bordered w-full"
              value={selectedServiceId || ""}
              onChange={(e) => {
                const serviceId = Number(e.target.value);
                setSelectedServiceId(serviceId);
                const selectedService = services.find(
                  (s) => s.id === serviceId
                );
                const newDuration = selectedService?.duration_minutes || 0;
                setSelectedServiceDuration(newDuration);

                // Recalculate if current slot still valid
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
                const lastSlotId = filteredSlots[filteredSlots.length - 1]?.id;
                const isLastSlot = startSlot?.id === lastSlotId;

                const valid = visibleFree && (missingBlocks <= 0 || isLastSlot);

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
        )}
      </div>

      {loading ? (
        <p className="text-center">Loading slots...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredSlots.map((slot, index) => {
            const isSelected = selectedSlotId === slot.id;
            const isBlocked =
              slot.is_booked || slot.is_inherited_block || !selectedServiceId;

            const handleSelectSlot = () => {
              const requiredBlocks = getRequiredBlocks(selectedServiceDuration);
              const futureSlots = filteredSlots.slice(index);

              const relevantSlice = futureSlots.slice(0, requiredBlocks);

              // NEW LOGIC: Allow booking even if inherited blocks go beyond seeded slots
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

              // ⚡ If slots run out but it's the last visible slot — allow inherited blocks to fall off map
              if (missingSlots > 0 && !isSelected) {
                console.warn(
                  "⚠️ Booking extends beyond visible slots — inherited blocks will apply server-side."
                );
              }

              setSelectedSlotId((prev) => (prev === slot.id ? null : slot.id));
            };

            return (
              <div key={slot.id} className="flex flex-col">
                <button
                  className={`btn w-full text-sm ${
                    isBlocked
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed opacity-60"
                      : isSelected
                      ? "btn-primary text-white"
                      : "btn-outline text-white border-white"
                  }`}
                  onClick={() => {
                    if (slot.is_booked || slot.is_inherited_block) return;
                    if (loading) return;
                    if (!selectedServiceId) {
                      showToast("❌ Please select a service first.", "error");
                      return;
                    }
                    handleSelectSlot();
                  }}
                  type="button"
                >
                  <span className="text-xs w-full text-center">
                    {/* {convertToUserTime(
                      slot.time,
                      freelancerTimeZone,
                      userTimeZone
                    )}{" "}
                    <span className="text-[10px] text-gray-400">
                      {getTZAbbreviation(userTimeZone)}
                    </span> */}
                    {slot.time} UTC
                  </span>
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
            );
          })}
        </div>
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

        <HoneypotInput value={honeypot} setValue={setHoneypot} />

        <button
          className={`btn w-full ${
            submitting || !selectedSlotId
              ? "opacity-50 cursor-not-allowed btn-primary"
              : cooldownRemaining > 0
              ? "btn-outline text-white border-yellow-500"
              : "btn-primary"
          }`}
          disabled={!selectedSlotId || submitting}
          type="submit"
        >
          {submitting
            ? "Submitting..."
            : cooldownRemaining > 0
            ? `Please wait (${cooldownRemaining}s)`
            : "Book Appointment"}
        </button>
      </form>

      <NoShowPolicy policy={noShowPolicy} />

      <FAQCard text={branding.faq_text} />
    </div>
  );
}
