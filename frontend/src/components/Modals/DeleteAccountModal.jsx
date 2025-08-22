import { useState } from "react";
import BaseModal from "./BaseModal";
import { showToast } from "../../utils/toast";
import axios from "../../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import { useFreelancer } from "../../context/FreelancerContext";

export default function DeleteAccountModal({ open, onClose }) {
  const navigate = useNavigate();
  const { freelancer } = useFreelancer();

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!emailInput || !passwordInput) {
      showToast("⚠️ Enter both email and password to confirm.", "warning");
      return;
    }

    if (emailInput.trim().toLowerCase() !== freelancer?.email?.toLowerCase()) {
      showToast("❌ Email does not match your account.", "error");
      return;
    }

    try {
      setSubmitting(true);
      await axios.delete("/freelancer/account", {
        data: { password: passwordInput },
      });

      localStorage.clear();
      showToast("❌ Account deleted. Goodbye!", "success");
      navigate("/auth", { state: { accountDeleted: true } });
    } catch (err) {
      console.error(err);
      showToast("❌ Error deleting account. Check your password.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseModal open={open} onClose={onClose}>
      <div className="text-center space-y-6 text-white">
        <h2 className="text-xl font-bold text-red-600 uppercase">
          Delete Account
        </h2>
        <p className="text-sm font-medium">
          This action is{" "}
          <span className="text-red-500 font-bold">permanent</span> and cannot
          be undone.
          <br />
          Please confirm by entering your email and current password.
        </p>

        <div className="space-y-3">
          <input
            type="email"
            className="input input-bordered w-full"
            placeholder="Your email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
          <input
            type="password"
            className="input input-bordered w-full"
            placeholder="Current password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
        </div>

        <div className="flex justify-center gap-4 pt-4">
          <button
            onClick={onClose}
            className="btn btn-outline btn-sm border-white text-white hover:bg-base-300"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={submitting}
            className="btn btn-error btn-sm"
          >
            {submitting ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
