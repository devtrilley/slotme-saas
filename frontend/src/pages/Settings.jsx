import { useEffect, useState } from "react";
import { useFreelancer } from "../context/FreelancerContext";
import { showToast } from "../utils/toast";
import axios from "../utils/axiosInstance";
import { setStoredFreelancer } from "../utils/setStoredFreelancer";
import { isTokenExpired } from "../utils/jwt";
import { useNavigate } from "react-router-dom";
import DeleteAccountModal from "../components/Modals/DeleteAccountModal";
import CancelSubscriptionModal from "../components/Modals/CancelSubscriptionModal";
import PasswordChecklist from "../components/Inputs/PasswordChecklist";
import TierStatusCard from "../components/Cards/TierStatusCard";
import FreelancerBranding from "../components/Forms/FreelancerBranding";
import AccordionSection from "../components/Layout/AccordionSection";

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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPasswordChecklist, setShowPasswordChecklist] = useState(false);

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
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Settings</h1>

      {/* 🟢 ACCOUNT INFORMATION */}
      <AccordionSection
        title="Account Information"
        subtitle="Name, email, phone, business"
        defaultOpen={true}
      >
        {/* Current Info Preview */}
        <div className="p-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-md text-sm space-y-1 mb-4">
          <p>
            <strong>Name:</strong> {freelancer?.first_name}{" "}
            {freelancer?.last_name}
          </p>
          <p>
            <strong>Email:</strong> {freelancer?.email || "—"}
          </p>
          <p>
            <strong>Personal Phone:</strong> {freelancer?.phone || "—"}
          </p>
          <p>
            <strong>Business Name:</strong> {freelancer?.business_name || "—"}
          </p>
        </div>

        {/* Profile Update Form */}
        <div className="p-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-md space-y-4">
          <h2 className="text-lg font-semibold text-center">Update Info</h2>

          <div>
            <label className="text-sm text-white font-medium block mb-1.5">
              Personal Phone Number (Private):
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input input-bordered w-full"
              placeholder="New phone"
            />
          </div>

          <div>
            <label className="text-sm text-white font-medium block mb-1.5">
              Business Name
            </label>
            <input
              name="business_name"
              value={formData.business_name}
              onChange={handleChange}
              className="input input-bordered w-full"
              placeholder="New business name"
            />
          </div>

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
                  if (
                    [
                      "password",
                      "new_password",
                      "first_name",
                      "last_name",
                      "email", // 🔥 Don't save email from this form
                    ].includes(key)
                  )
                    return;
                  if (value.trim()) updatedData[key] = value.trim();
                });

                if (Object.keys(updatedData).length === 0) {
                  showToast("No changes to save.", "info");
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
                  email: "",
                  phone: "",
                  business_name: "",
                }));
              } catch (err) {
                console.error(err);
                showToast("Couldn't update profile. Try again.", "error");
              }
            }}
            className="btn btn-primary w-full"
          >
            Save Changes
          </button>
        </div>
      </AccordionSection>

      {/* 🎨 BRANDING */}
      <AccordionSection
        title="Business Profile & Branding"
        subtitle="Logo, bio, tagline, etc"
      >
        <div className="p-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-md">
          <FreelancerBranding
            onUpdate={() => {
              showToast("Branding updated.", "success");
            }}
          />
        </div>
      </AccordionSection>

      {/* 📱 UI PREFERENCES */}
      <AccordionSection
        title="UI Preferences"
        subtitle="Customize your interface"
      >
        <div className="p-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-md space-y-4">
          <h2 className="text-lg font-semibold text-center">
            Mobile Navigation
          </h2>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={freelancer?.show_footer_navbar ?? true}
              onChange={async (e) => {
                const newValue = e.target.checked;
                try {
                  await axios.patch("/freelancer/account", {
                    show_footer_navbar: newValue,
                  });

                  // Update context
                  setFreelancer((prev) => ({
                    ...prev,
                    show_footer_navbar: newValue,
                  }));

                  showToast(
                    newValue
                      ? "Footer navbar enabled"
                      : "Footer navbar disabled",
                    "success"
                  );
                } catch (err) {
                  console.error("Failed to update footer navbar setting:", err);
                  showToast("Couldn't save preference. Try again.", "error");
                }
              }}
              className="checkbox checkbox-sm mt-0.5 shrink-0"
            />
            <span className="text-sm leading-6">
              <span className="font-medium">Enable Footer Navbar (Mobile)</span>
              <span className="block mt-1 text-xs text-gray-400">
                Show quick navigation buttons at the bottom on mobile devices
              </span>
            </span>
          </label>
        </div>
      </AccordionSection>

      {/* 🔐 EMAIL & PASSWORD */}
      <AccordionSection title="Email & Password" subtitle="Security settings">
        {/* Change Email */}
        <div className="p-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-md space-y-4 mb-4">
          <h2 className="text-lg font-semibold text-center">Change Email</h2>

          <div>
            <label className="text-sm text-white font-medium block mb-1.5">
              New Email
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              placeholder="your.new.email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-white font-medium block mb-1.5">
              Confirm New Email
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              placeholder="your.new.email@example.com"
              value={confirmNewEmail}
              onChange={(e) => setConfirmNewEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-white font-medium block mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="Enter your current password"
              value={currentPwForEmail}
              onChange={(e) => setCurrentPwForEmail(e.target.value)}
            />
          </div>

          <button
            disabled={sendingEmailChange}
            className="btn btn-primary w-full"
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
                showToast(`Verification link sent to ${ne}`, "info", 7000);
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
            We'll email a confirmation link to your new address. The change
            completes after you click it.
          </p>
        </div>

        {/* Change Password */}
        <div className="p-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-md space-y-4">
          <h2 className="text-lg font-semibold text-center">Change Password</h2>

          <div>
            <label className="text-sm text-white font-medium block mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input input-bordered w-full"
              placeholder="Enter your current password"
            />
          </div>

          <div>
            <label className="text-sm text-white font-medium block mb-1.5">
              New Password
            </label>
            <div className="space-y-1">
              <input
                type="password"
                name="new_password"
                value={formData.new_password}
                onFocus={() => setShowPasswordChecklist(true)}
                onChange={handleChange}
                onBlur={() => {
                  if (formData.new_password.length === 0)
                    setShowPasswordChecklist(false);
                }}
                className="input input-bordered w-full"
                placeholder="Enter new password"
              />

              {showPasswordChecklist && (
                <PasswordChecklist
                  password={formData.new_password}
                  confirmPassword={formData.confirm_new_password}
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-sm text-white font-medium block mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              name="confirm_new_password"
              value={formData.confirm_new_password}
              onChange={handleChange}
              className="input input-bordered w-full"
              placeholder="Re-enter new password"
            />
          </div>

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
                const validatePassword = (password) => {
                  const errors = [];
                  if (password.length < 8) errors.push("At least 8 characters");
                  if (!/[A-Z]/.test(password))
                    errors.push("At least one uppercase letter");
                  if (!/[a-z]/.test(password))
                    errors.push("At least one lowercase letter");
                  if (!/[0-9]/.test(password))
                    errors.push("At least one number");
                  if (!/[^A-Za-z0-9]/.test(password))
                    errors.push("At least one special character");
                  return { valid: errors.length === 0, errors };
                };

                const { valid, errors } = validatePassword(
                  formData.new_password
                );
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
                  confirm_new_password: "",
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
      </AccordionSection>

      {/* 💳 SUBSCRIPTION & BILLING */}
      {freelancer?.tier !== "free" && (
        <AccordionSection
          title="Subscription & Billing"
          subtitle="Manage your plan"
        >
          <div className="p-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-md space-y-4">
            <h2 className="text-lg font-semibold text-center">Subscription</h2>

            <TierStatusCard tier={freelancer?.tier} />

            <button
              onClick={() => navigate("/upgrade")}
              className="btn btn-primary w-full"
            >
              Change Subscription
            </button>

            <button
              onClick={() => setShowCancelModal(true)}
              className="btn bg-red-600 hover:bg-red-700 text-white border-none w-full"
            >
              Cancel Subscription
            </button>

            <p className="text-xs text-center text-gray-500">
              Your subscription will remain active until the end of your current
              billing period.
            </p>
          </div>
        </AccordionSection>
      )}

      {/* 🔴 DANGER ZONE */}
      <AccordionSection
        title="Danger Zone"
        subtitle="⚠️ Delete account"
        color="red"
      >
        <div className="p-5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-red-500 rounded-2xl shadow-md space-y-4">
          <h2 className="text-lg font-semibold text-red-500 text-center">
            Delete My Account
          </h2>
          <p className="text-sm text-center text-gray-500">
            This action cannot be undone. All your data will be permanently
            deleted.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn btn-error w-full"
          >
            Delete My Account
          </button>
        </div>
      </AccordionSection>

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />

      <CancelSubscriptionModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        tier={freelancer?.tier}
        onConfirm={async () => {
          const token = localStorage.getItem("access_token");
          if (!token || isTokenExpired(token)) {
            showToast("Session expired. Please log in again.", "error");
            localStorage.clear();
            setTimeout(() => {
              navigate("/auth", { state: { sessionExpired: true } });
            }, 1000);
            return;
          }

          try {
            await axios.post("/stripe/cancel-subscription");

            showToast(
              `Subscription cancelled. You'll have access until your billing period ends.`,
              "success",
              8000
            );

            const res = await axios.get("/freelancer/me");
            setFreelancer(res.data);
            setStoredFreelancer(res.data);

            setShowCancelModal(false);
          } catch (err) {
            const msg =
              err?.response?.data?.error || "Failed to cancel subscription";
            showToast(msg, "error");
            console.error("Cancel subscription error:", err);
          }
        }}
      />
    </main>
  );
}
