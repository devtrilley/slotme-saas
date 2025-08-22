import { useEffect, useState } from "react";
import { useFreelancer } from "../context/FreelancerContext";
import { showToast } from "../utils/toast";
import axios from "../utils/axiosInstance";
import { setStoredFreelancer } from "../utils/setStoredFreelancer";
import { isTokenExpired } from "../utils/jwt";
import { useNavigate } from "react-router-dom";
import DeleteAccountModal from "../components/Modals/DeleteAccountModal";

export default function Settings() {
  const { freelancer, setFreelancer } = useFreelancer();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    business_name: "",
    password: "",
    new_password: "",
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/auth", { state: { sessionExpired: true } });
      return;
    }

    async function fetchFreelancer() {
      try {
        const res = await axios.get("/freelancer/me");
        setFreelancer(res.data);
      } catch (err) {
        console.error("Error fetching freelancer profile", err);
      }
    }

    fetchFreelancer();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold mb-4 text-center">Settings</h1>

      {/* 🟢 CURRENT INFO PREVIEW */}
      <div className="bg-base-200 p-4 rounded-xl border text-sm">
        <p>
          <strong>First Name:</strong> {freelancer?.first_name || "—"}
        </p>
        <p>
          <strong>Last Name:</strong> {freelancer?.last_name || "—"}
        </p>
        <p>
          <strong>Email:</strong> {freelancer?.email || "—"}
        </p>
        <p>
          <strong>Phone:</strong> {freelancer?.phone || "—"}
        </p>
        <p>
          <strong>Business Name:</strong> {freelancer?.business_name || "—"}
        </p>
      </div>

      {/* 🛠️ PROFILE UPDATE FORM */}
      <div className="bg-base-100 p-6 rounded-xl shadow-md space-y-4">
        <h2 className="text-lg font-semibold text-center">Update Info</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            className="input input-bordered"
            placeholder="New first name"
          />
          <input
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            className="input input-bordered"
            placeholder="New last name"
          />
        </div>

        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="input input-bordered"
          placeholder="New email"
        />
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="input input-bordered"
          placeholder="New phone"
        />
        <input
          name="business_name"
          value={formData.business_name}
          onChange={handleChange}
          className="input input-bordered"
          placeholder="New business name"
        />

        <button
          onClick={async () => {
            const token = localStorage.getItem("access_token");
            if (!token || isTokenExpired(token)) {
              showToast("⛔ Session expired. Please log in again.", "error");
              localStorage.clear();
              setTimeout(() => {
                navigate("/auth", { state: { sessionExpired: true } });
              }, 1000);
              return;
            }

            try {
              const updatedData = {};
              Object.entries(formData).forEach(([key, value]) => {
                if (["password", "new_password"].includes(key)) return;
                if (value.trim()) updatedData[key] = value.trim();
              });

              if (Object.keys(updatedData).length === 0) {
                showToast("⚠️ No changes to update.", "warning");
                return;
              }

              // Basic validation
              if (
                updatedData.email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatedData.email)
              ) {
                showToast("❌ Please enter a valid email address.", "error");
                return;
              }

              if (
                updatedData.phone &&
                !/^\+?[0-9\s\-()]{7,20}$/.test(updatedData.phone)
              ) {
                showToast("❌ Please enter a valid phone number.", "error");
                return;
              }

              await axios.patch("/freelancer/account", updatedData);

              showToast("✅ Profile updated.", "success");

              try {
                const res = await axios.get("/freelancer/me");
                setFreelancer(res.data);
                setStoredFreelancer(res.data);
              } catch (err) {
                if (err?.response?.status === 401) {
                  localStorage.clear();
                  navigate("/auth", { state: { sessionExpired: true } });
                  return;
                }
              }

              setFormData((prev) => ({
                ...prev,
                first_name: "",
                last_name: "",
                email: "",
                phone: "",
                business_name: "",
              }));
            } catch (err) {
              console.error(err);
              showToast("❌ Error updating profile.", "error");
            }
          }}
          className="btn btn-primary block mx-auto"
        >
          Save Changes
        </button>
      </div>

      {/* 🔐 PASSWORD CHANGE */}
      <div className="bg-base-100 p-6 rounded-xl shadow-md space-y-4">
        <h2 className="text-lg font-semibold text-center">Change Password</h2>
        <input
          type="password"
          name="new_password"
          value={formData.new_password}
          onChange={handleChange}
          className="input input-bordered"
          placeholder="New password"
        />
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          className="input input-bordered"
          placeholder="Current password"
        />
        <button
          onClick={async () => {
            const token = localStorage.getItem("access_token");
            if (!token || isTokenExpired(token)) {
              showToast("⛔ Session expired. Please log in again.", "error");
              localStorage.clear();
              setTimeout(() => {
                navigate("/auth", { state: { sessionExpired: true } });
              }, 1000);
              return;
            }

            try {
              await axios.patch("/freelancer/account", {
                password: formData.password,
                new_password: formData.new_password,
              });
              showToast("✅ Password updated.", "success");
              setFormData((prev) => ({
                ...prev,
                password: "",
                new_password: "",
              }));
            } catch (err) {
              console.error(err);
              showToast("❌ Error updating password.", "error");
            }
          }}
          className="btn btn-primary block mx-auto"
        >
          Change Password
        </button>
      </div>

      {/* 🔴 DANGER ZONE */}
      <div className="bg-base-100 p-6 rounded-xl shadow-md border border-red-500 space-y-4 mt-32">
        <h2 className="text-lg font-semibold text-red-500 text-center">
          Danger Zone
        </h2>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn btn-error w-full"
        >
          Delete My Account
        </button>
      </div>
      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
