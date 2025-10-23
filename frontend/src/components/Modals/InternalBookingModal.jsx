import BaseModal from "./BaseModal";
import { useState, useEffect } from "react";
import axios from "../../utils/axiosInstance";
import { API_BASE } from "../../utils/constants";
import { showToast } from "../../utils/toast";

export default function InternalBookingModal({
  visible,
  onClose,
  services,
  selectedDate,
  refetch,
  preselectedTime = "",
  slotId = null,
  freelancerTimezone,
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setServiceId("");
  }, [visible]);

  if (!visible) return null;

  const handleCreate = async () => {
    const token = localStorage.getItem("access_token");

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !serviceId ||
      !preselectedTime
    ) {
      showToast("Fill out all fields to book.", "warning");
      return;
    }

    if (!slotId) {
      console.warn("⚠️ No slot ID provided for internal booking.");
    }

    setLoading(true);
    try {
      await axios.post(
        `${API_BASE}/appointments/internal`,
        {
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          service_id: serviceId,
          slot_id: slotId,
          freelancer_timezone: freelancerTimezone, // ✅ add this
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      showToast(
        `Booking added${preselectedTime ? ` for ${preselectedTime}` : ""}`,
        "success"
      );
      refetch?.();
      onClose();
    } catch (err) {
      console.error("❌ Internal booking failed:", err);
      const msg =
  err.response?.data?.error ||
  err.response?.data?.message ||
  "Booking failed. Check fields and try again.";
showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Internal Booking Entry"
    >
      <div className="space-y-3 pt-1 pb-3">
        <p className="text-sm text-gray-400 text-center">
          Enter your customer’s info below to manually add a booking.
        </p>

        <div>
          <label className="text-sm block mb-1">Customer First Name</label>
          <input
            className="input input-bordered w-full"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm block mb-1">Customer Last Name</label>
          <input
            className="input input-bordered w-full"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm block mb-1">Customer Email</label>
          <input
            className="input input-bordered w-full"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm block mb-1">Customer Phone Number</label>
          <input
            className="input input-bordered w-full"
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm block mb-1">Select Service</label>
          <select
            className="select select-bordered w-full"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Select a service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} – ${s.price_usd} ({s.duration_minutes} min)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm block mb-1">Selected Time Slot</label>
          <input
            className="input input-bordered w-full"
            value={preselectedTime}
            disabled
          />
        </div>

        <button
          className="btn btn-primary w-full"
          disabled={loading || !slotId}
          onClick={handleCreate}
        >
          {loading ? "Creating..." : "Add Booking"}
        </button>
      </div>
    </BaseModal>
  );
}
