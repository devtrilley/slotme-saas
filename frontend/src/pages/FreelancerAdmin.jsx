import { useEffect, useState } from "react";
import axios from "axios";
import FreelancerBranding from "../components/FreelancerBranding";
import { showToast } from "../utils/toast";
import AddSlotForm from "../components/AddSlotForm";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import FreelancerCard from "../components/FreelancerCard";
import FreelancerModal from "../components/FreelancerModal";
import ServiceCard from "../components/ServiceCard";
import ServiceForm from "../components/ServiceForm";

function getDateFromTimeStr(timeStr) {
  const [hourMinute, ampm] = timeStr.split(" ");
  let [hour, minute] = hourMinute.split(":").map(Number);
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

export default function AdminPage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [branding, setBranding] = useState({
    name: "",
    logo_url: "",
    tagline: "",
    bio: "",
    is_verified: false,
  });
  const [showModal, setShowModal] = useState(false);
  const [services, setServices] = useState([]);

  const fetchSlots = () => {
    setLoading(true);
    axios
      .get("http://127.0.0.1:5000/slots", {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
        },
      })
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => {
          const dateA = new Date(`${a.day} ${a.time}`);
          const dateB = new Date(`${b.day} ${b.time}`);
          return dateA - dateB;
        });
        setSlots(sorted);
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
      .get("http://127.0.0.1:5000/freelancer/services", {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
        },
      })
      .then((res) => setServices(res.data))
      .catch((err) => console.error("❌ Failed to fetch services", err));
  };

  const fetchBranding = () => {
    axios
      .get("http://127.0.0.1:5000/freelancer-info", {
        headers: { "X-Freelancer-ID": localStorage.getItem("freelancer_id") },
      })
      .then((res) => {
        setBranding({
          name: res.data.name || "",
          logo_url: res.data.logo_url || "",
          tagline: res.data.tagline || "",
          bio: res.data.bio || "",
          timezone: res.data.timezone || "America/New_York",
          is_verified: res.data.is_verified || false,
        });
      })
      .catch((err) => {
        console.error("❌ Failed to load branding", err);
      });
  };

  const handleDelete = (slotId) => {
    if (!confirm("Are you sure you want to delete this time slot?")) return;

    axios
      .delete(`http://127.0.0.1:5000/slots/${slotId}`, {
        headers: {
          "X-Freelancer-ID": localStorage.getItem("freelancer_id"),
        },
      })
      .then(() => {
        showToast("Slot deleted");
        fetchSlots();
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Failed to delete slot";
        showToast(msg, "error");
      });
  };

  const handleDeleteService = (serviceId) => {
    axios
      .delete(`http://127.0.0.1:5000/freelancer/services/${serviceId}`, {
        headers: { "X-Freelancer-ID": localStorage.getItem("freelancer_id") },
      })
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
      .patch(
        `http://127.0.0.1:5000/freelancer/services/${serviceId}`,
        {
          price_usd: newPrice,
        },
        {
          headers: { "X-Freelancer-ID": localStorage.getItem("freelancer_id") },
        }
      )
      .then(() => {
        showToast("Price updated");
        fetchServices();
      })
      .catch((err) => {
        console.error("❌ Failed to update price", err);
        showToast("Could not update price", "error");
      });
  };

  const [brandingUpdated, setBrandingUpdated] = useState(0);

  useEffect(() => {
    fetchSlots();
    fetchBranding();
    fetchServices();
  }, [brandingUpdated]);

  const shareUrl = `http://localhost:5173/book/${localStorage.getItem(
    "freelancer_id"
  )}`;

  const filteredSlots = slots.filter(
    (slot) => slot.day === selectedDate.toISOString().split("T")[0]
  );

  function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2 items-center">
        <h2 className="text-2xl font-bold text-center">
          Freelancer Admin Dashboard
        </h2>
        <button
          onClick={() => {
            localStorage.removeItem("freelancer_logged_in");
            window.location.href = "/";
          }}
          className="btn btn-sm btn-outline"
        >
          Logout
        </button>
      </div>

      <FreelancerCard
        name={branding.name}
        logoUrl={branding.logo_url}
        tagline={branding.tagline}
        bio={branding.bio}
        isVerified={branding.is_verified}
        onClick={() => setShowModal(true)}
      />

      {showModal && (
        <FreelancerModal
          freelancer={{
            ...branding,
            id: localStorage.getItem("freelancer_id"),
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="p-4 bg-base-200 border rounded-lg shadow space-y-2">
        <p className="text-sm font-medium text-center">
          Your Public Booking Link
        </p>
        <p className="text-sm text-primary text-center break-words">
          {shareUrl}
        </p>
        <button
          className="btn btn-xs btn-outline block mx-auto"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            showToast("Link copied to clipboard!");
          }}
        >
          Copy Link
        </button>
      </div>

      <AddSlotForm onAdd={fetchSlots} />

      {loading && <p className="text-center">Loading...</p>}
      {fetchError && <p className="text-red-500 text-center">{fetchError}</p>}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-center border-b pb-1 mt-12">
          Your Time Slots
        </h3>

        <label className="text-sm text-gray-400 block text-center">
          Select a date to view / edit your time slots:
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

        {filteredSlots.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            No slots for this day.
          </p>
        ) : (
          filteredSlots.map((slot) => (
            <div
              key={slot.id}
              className="p-4 border rounded-lg bg-base-100 shadow-sm"
            >
              <p className="text-xs text-gray-400 mb-1">
                {formatDate(slot.day)}
              </p>
              <p className="text-lg font-semibold flex items-center gap-1">
                {slot.time}
                <span className="text-xs text-gray-400">
                  {branding.timezone?.split("/")[1]?.replace("_", " ") || "EST"}
                </span>
              </p>
              {slot.is_booked ? (
                slot.appointment?.name && slot.appointment?.email ? (
                  <>
                    <p className="text-sm">Booked by:</p>
                    <p className="text-sm text-primary">
                      {slot.appointment.name} ({slot.appointment.email})
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-red-400">Booked (no details)</p>
                )
              ) : (
                <p className="text-sm text-success">Available</p>
              )}
              {!slot.is_booked && (
                <button
                  onClick={() => handleDelete(slot.id)}
                  className="btn btn-xs btn-error mt-2"
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <ServiceForm onServiceAdded={fetchServices} />
      {services.map((s) => (
        <ServiceCard
          key={s.id}
          id={s.id}
          name={s.name}
          description={s.description}
          duration_minutes={s.duration_minutes}
          price_usd={s.price_usd}
          is_enabled={s.is_enabled}
          onUpdate={fetchServices}
        />
      ))}

      <FreelancerBranding onUpdate={() => setBrandingUpdated((n) => n + 1)} />
    </div>
  );
}
