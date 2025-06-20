import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
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

export default function BookingPage() {
  const { freelancerId } = useParams();
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
        }
      })
      .catch((err) => {
        console.error("❌ Failed to fetch freelancer info", err);
      });
  };

  useEffect(() => {
    fetchSlots();
    fetchFreelancerInfo(); // already does all the branding/service logic
  }, [freelancerId]);

  const fetchSlots = () => {
    setLoading(true);
    axios
      .get(`${API_BASE}/freelancer/slots/${freelancerId}`)
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => {
          const toDate = (timeStr) => {
            const [h, m] = timeStr.split(/[: ]/);
            let hour = parseInt(h),
              minute = parseInt(m);
            const isPM = timeStr.includes("PM");
            if (isPM && hour !== 12) hour += 12;
            if (!isPM && hour === 12) hour = 0;
            const date = new Date();
            date.setHours(hour, minute, 0, 0);
            return date;
          };
          return toDate(a.time) - toDate(b.time);
        });
        setSlots(sorted);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch slots", err);
        setError("Booking page unavailable.");
      })
      .finally(() => setLoading(false));
  };

  const navigate = useNavigate(); // ⬅ place this inside BookingPage()

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedSlotId) return;

    axios
      .post(`${API_BASE}/book`, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        slot_id: selectedSlotId,
        service_id: selectedServiceId,
      })
      .then((res) => {
        showToast("📨 Redirecting you now...", "info", 3000); // 3 sec blue toast
        const appointmentId = res.data.appointment_id;
        setTimeout(() => {
          navigate(`/booking-success?appointment_id=${appointmentId}`);
        }, 1000); // wait 1 sec before redirect
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Booking failed";
        showToast(msg, "error");
        console.error("❌", msg);
      });
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
                setSelectedServiceDuration(
                  selectedService?.duration_minutes || 0
                );
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
              const futureSlots = filteredSlots.slice(index); // all slots from this point on

              // Get the slice we need for this booking
              const relevantSlice = futureSlots.slice(0, requiredBlocks);

              // Check if all blocks that exist are free
              const allAreFree = relevantSlice.every(
                (s) => !s.is_booked && !s.is_inherited_block
              );

              if (!allAreFree) {
                showToast(
                  "❌ That time overlaps with an existing booking. Try a different time slot.",
                  "error"
                );
                return;
              }

              // ✅ Even if there aren't enough future blocks, we'll allow it — assume free time
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
                    if (!selectedServiceId) {
                      showToast("❌ Please select a service first.", "error");
                      return;
                    }
                    handleSelectSlot();
                  }}
                  type="button"
                >
                  <span className="text-xs w-full text-center">
                    {convertToUserTime(
                      slot.time,
                      freelancerTimeZone,
                      userTimeZone
                    )}{" "}
                    <span className="text-[10px] text-gray-400">
                      {getTZAbbreviation(userTimeZone)}
                    </span>
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
          onChange={(e) => setEmail(e.target.value)}
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

        <button
          className={`btn w-full btn-primary ${
            !selectedSlotId ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={!selectedSlotId}
        >
          Book Appointment
        </button>
      </form>

      <NoShowPolicy policy={noShowPolicy} />

      <FAQCard text={branding.faq_text} />
    </div>
  );
}
