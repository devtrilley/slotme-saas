import { useEffect, useState } from "react";
import { useFreelancer } from "../context/FreelancerContext";
import { showToast } from "../utils/toast";
import axios from "../utils/axiosInstance";
import { setStoredFreelancer } from "../utils/setStoredFreelancer";
import { isTokenExpired } from "../utils/jwt";
import { useNavigate } from "react-router-dom";
import DeleteAccountModal from "../components/Modals/DeleteAccountModal";
import PasswordChecklist from "../components/Inputs/PasswordChecklist";

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
    confirm_new_password: "",
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordChecklist, setShowPasswordChecklist] = useState(false);

  // inside Settings component, add local state:
  const [newEmail, setNewEmail] = useState("");
  const [confirmNewEmail, setConfirmNewEmail] = useState("");
  const [currentPwForEmail, setCurrentPwForEmail] = useState("");
  const [sendingEmailChange, setSendingEmailChange] = useState(false);

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
              showToast("Session expired. Logging out...", "warning");
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
                showToast("No changes to save.", "info");
                return;
              }

              // Basic validation
              if (
                updatedData.email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatedData.email)
              ) {
                showToast("Enter a valid email address.", "warning");
                return;
              }

              if (
                updatedData.phone &&
                !/^\+?[0-9\s\-()]{7,20}$/.test(updatedData.phone)
              ) {
                showToast("Enter a valid phone number.", "warning");
                return;
              }

              await axios.patch("/freelancer/account", updatedData);

              showToast("Profile updated.", "success");

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
              showToast("Couldn't update profile. Try again.", "error");
            }
          }}
          className="btn btn-primary block mx-auto"
        >
          Save Changes
        </button>
      </div>

      {/* 📧 CHANGE EMAIL */}
      <div className="bg-base-100 p-6 rounded-xl shadow-md space-y-4">
        <h2 className="text-lg font-semibold text-center">Change Email</h2>

        <input
          type="email"
          className="input input-bordered w-full"
          placeholder="New email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <input
          type="email"
          className="input input-bordered w-full"
          placeholder="Confirm new email"
          value={confirmNewEmail}
          onChange={(e) => setConfirmNewEmail(e.target.value)}
        />
        <input
          type="password"
          className="input input-bordered w-full"
          placeholder="Current password"
          value={currentPwForEmail}
          onChange={(e) => setCurrentPwForEmail(e.target.value)}
        />

        <button
          className="btn btn-primary w-full"
          disabled={sendingEmailChange}
          onClick={async () => {
            const token = localStorage.getItem("access_token");
            if (!token || isTokenExpired(token)) {
              showToast("⛔ Session expired. Please log in again.", "error");
              localStorage.clear();
              setTimeout(() => {
                navigate("/auth", { state: { sessionExpired: true } });
              }, 800);
              return;
            }

            // Basic UI validation
            const ne = newEmail.trim().toLowerCase();
            const ce = confirmNewEmail.trim().toLowerCase();
            if (!ne || !ce || ne !== ce) {
              showToast("Emails must match.", "warning");
              return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ne)) {
              showToast("Enter a valid email.", "warning");
              return;
            }
            if (!currentPwForEmail) {
              showToast("Enter your current password.", "warning");
              return;
            }

            try {
              setSendingEmailChange(true);
              await axios.post("/auth/change-email/request", {
                new_email: ne.trim().toLowerCase(),
                current_password: currentPwForEmail,
              });
              showToast(
                `Verification link sent to ${ne}`,
                "info",
                7000
              );
              setNewEmail("");
              setConfirmNewEmail("");
              setCurrentPwForEmail("");
            } catch (err) {
              const msg =
                err?.response?.data?.error || "Could not start email change.";
              showToast(msg, "error");
            } finally {
              setSendingEmailChange(false);
            }
          }}
        >
          Send verification link
        </button>

        <p className="text-xs text-center text-gray-500">
          We’ll email a confirmation link to your new address. The change
          completes after you click it.
        </p>
      </div>

      {/* 🔐 PASSWORD CHANGE */}
      <div className="bg-base-100 p-6 rounded-xl shadow-md space-y-4">
        <h2 className="text-lg font-semibold text-center">Change Password</h2>
        {/* New Password with checklist */}
        <div className="space-y-1">
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="input input-bordered mb-4"
            placeholder="Current password"
          />
          <input
            type="password"
            name="new_password"
            value={formData.new_password}
            onFocus={() => setShowPasswordChecklist(true)} // 👈 show on focus
            onChange={handleChange}
            onBlur={() => {
              if (formData.new_password.length === 0)
                setShowPasswordChecklist(false); // 👈 hide if empty
            }}
            className="input input-bordered w-full"
            placeholder="New password"
          />

          {/* ✅ Live checklist */}
          {showPasswordChecklist && (
            <PasswordChecklist
              password={formData.new_password}
              confirmPassword={formData.confirm_new_password}
            />
          )}
        </div>
        <input
          type="password"
          name="confirm_new_password"
          value={formData.confirm_new_password}
          onChange={handleChange}
          className="input input-bordered"
          placeholder="Confirm new password"
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
              // ✅ Validate password strength before update
              const validatePassword = (password) => {
                const errors = [];
                if (password.length < 8) errors.push("At least 8 characters");
                if (!/[A-Z]/.test(password))
                  errors.push("At least one uppercase letter");
                if (!/[a-z]/.test(password))
                  errors.push("At least one lowercase letter");
                if (!/[0-9]/.test(password)) errors.push("At least one number");
                if (!/[^A-Za-z0-9]/.test(password))
                  errors.push("At least one special character");
                return { valid: errors.length === 0, errors };
              };

              const { valid, errors } = validatePassword(formData.new_password);
              if (!valid) {
                showToast("Password doesn't meet requirements.", "warning");
                return;
              }

              await axios.patch("/freelancer/account", {
                password: formData.password,
                new_password: formData.new_password,
              });
              showToast("Password updated.", "success");
              setFormData((prev) => ({
                ...prev,
                password: "",
                new_password: "",
              }));
            } catch (err) {
              console.error(err);
              showToast("Couldn't update password. Try again.", "error");
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
