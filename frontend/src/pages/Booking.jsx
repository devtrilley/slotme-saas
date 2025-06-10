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
  const [noShowPolicy, setNoShowPolicy] = useState("");

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  useEffect(() => {
    fetchSlots();

    axios
      .get(`http://127.0.0.1:5000/freelancer/public-info/${freelancerId}`)
      .then((res) => {
        setBranding({
          first_name: res.data.first_name || "",
          last_name: res.data.last_name || "",
          business_name: res.data.business_name || "",
          logo_url: res.data.logo_url || "",
          tagline: res.data.tagline || "",
          bio: res.data.bio || "",
          is_verified: res.data.is_verified || false,
          faq_text: res.data.faq_text || "",
        });
        setFreelancerTimeZone(res.data.timezone || "America/New_York");
        setNoShowPolicy(res.data.no_show_policy || "");

        // ✅ Set services here
        const enabled = res.data.services || [];
        setServices(enabled);
        if (enabled.length === 1) {
          setSelectedServiceId(enabled[0].id); // auto-select if only one
        }
      })
      .catch((err) => {
        console.error("❌ Failed to load branding/services", err);
      });
  }, [freelancerId]);

  const fetchSlots = () => {
    setLoading(true);
    axios
      .get(`http://127.0.0.1:5000/freelancer/slots/${freelancerId}`)
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedSlotId) return;

    axios
      .post("http://127.0.0.1:5000/book", {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        slot_id: selectedSlotId,
        service_id: selectedServiceId,
      })
      .then(() => {
        setSuccess(true);
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setSelectedSlotId(null);
        setTimeout(() => setSuccess(false), 4000);
        fetchSlots();
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Booking failed";
        setError(msg);
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

  const filteredSlots = slots.filter(
    (s) => s.day === selectedDate.toISOString().split("T")[0]
  );

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
          onClick={fetchSlots}
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

      <div className="space-y-2">
        <label className="text-sm text-gray-400 block text-center">
          Select a date:
        </label>
        <div className="relative w-full">
          <DatePicker
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
      </div>

      {success && (
        <div className="alert alert-info shadow-lg">
          <span>
            📧 We’ve sent a confirmation link to your email. Please verify to
            finalize your booking.
          </span>
        </div>
      )}

      {error && (
        <div className="alert alert-error shadow-lg">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-center">Loading slots...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className="flex flex-col">
              <button
                className={`btn w-full text-sm ${
                  slot.is_booked
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : selectedSlotId === slot.id
                    ? "btn-primary text-white"
                    : "btn-outline text-white border-white"
                }`}
                onClick={() =>
                  !slot.is_booked &&
                  setSelectedSlotId((prev) =>
                    prev === slot.id ? null : slot.id
                  )
                }
                disabled={slot.is_booked}
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
                <span className="text-xs text-red-400 mt-1 text-center">
                  Booked
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {services.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm text-gray-400 block text-center">
            Select a service:
          </label>
          <select
            className="select select-bordered w-full"
            value={selectedServiceId || ""}
            onChange={(e) => setSelectedServiceId(Number(e.target.value))}
            required
          >
            <option value="" disabled>
              -- Choose a service --
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (${s.price_usd?.toFixed(2) || "0.00"})
              </option>
            ))}
          </select>
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
