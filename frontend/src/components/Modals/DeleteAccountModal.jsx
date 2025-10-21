import { useState } from "react";
import BaseModal from "./BaseModal";
import { showToast } from "../../utils/toast";
import axios from "../../utils/axiosInstance";
import { useFreelancer } from "../../context/FreelancerContext";

export default function DeleteAccountModal({ open, onClose }) {
  const { freelancer } = useFreelancer();

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleInitiate = async () => {
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
      await axios.post("/freelancer/delete-initiate", {
        email: emailInput,
        password: passwordInput,
      });

      setEmailSent(true);
      showToast("📧 Confirmation email sent! Check your inbox.", "success");
    } catch (err) {
      console.error(err);
      const errorMsg = err?.response?.data?.error || "Failed to initiate deletion";
      showToast(`❌ ${errorMsg}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmailInput("");
    setPasswordInput("");
    setEmailSent(false);
    onClose();
  };

  return (
    <BaseModal open={open} onClose={handleClose}>
      <div className="text-center space-y-6 text-white">
        {!emailSent ? (
          <>
            <h2 className="text-xl font-bold text-red-600 uppercase">
              Delete Account
            </h2>
            <p className="text-sm font-medium">
              This action is{" "}
              <span className="text-red-500 font-bold">permanent</span> and
              cannot be undone.
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
                onClick={handleClose}
                className="btn btn-outline btn-sm border-white text-white hover:bg-base-300"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiate}
                disabled={submitting}
                className="btn btn-error btn-sm"
              >
                {submitting ? "Sending..." : "Send Confirmation Email"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-green-500 uppercase">
              📧 Email Sent!
            </h2>
            <p className="text-sm font-medium">
              We sent a confirmation link to <strong>{freelancer?.email}</strong>.
              <br />
              <br />
              Click the link in your email to complete account deletion.
              <br />
              <span className="text-yellow-400">⏰ The link expires in 15 minutes.</span>
            </p>

            <button
              onClick={handleClose}
              className="btn btn-primary btn-sm mx-auto"
            >
              Close
            </button>
          </>
        )}
      </div>
    </BaseModal>
  );
}