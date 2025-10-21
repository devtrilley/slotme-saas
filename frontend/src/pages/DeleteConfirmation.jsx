import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { showToast } from "../utils/toast";
import BaseModal from "../components/Modals/BaseModal";
import SafetyTip from "../components/Callouts/SafetyTip";

export default function DeleteConfirmation() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");
  const [freelancerName, setFreelancerName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await axios.get(`/freelancer/delete-confirm/${token}`);
        setValid(true);
        setFreelancerName(res.data.freelancer?.first_name || "");
        setLoading(false);
      } catch (err) {
        console.error(err);
        const errorMsg = err?.response?.data?.error || "Invalid token";
        setError(errorMsg);
        setLoading(false);
      }
    }

    if (token) {
      validateToken();
    }
  }, [token]);

  const handleDeleteClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleting(true);
      await axios.post(`/freelancer/delete-finalize/${token}`);

      localStorage.clear();
      showToast("👋 Account successfully deleted. Goodbye.", "success");

      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (err) {
      console.error(err);
      const errorMsg = err?.response?.data?.error || "Failed to delete account";
      showToast(`❌ ${errorMsg}`, "error");
      setDeleting(false);
      setShowConfirmModal(false);
    }
  };

  const handleCloseModal = () => {
    setShowConfirmModal(false);
    setConfirmText("");
  };

  const isConfirmValid = confirmText.trim().toLowerCase() === "delete";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="text-center space-y-4">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="text-lg">Verifying deletion link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="max-w-md p-8 bg-base-100 rounded-xl shadow-lg text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-500">❌ {error}</h1>
          <p className="text-sm">
            {error === "Token expired"
              ? "Your deletion link has expired. Please request a new one from Settings."
              : "This deletion link is invalid or has already been used."}
          </p>
          <button
            onClick={() => navigate("/settings")}
            className="btn btn-primary btn-sm"
          >
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
        <div className="max-w-lg w-full p-8 bg-base-100 rounded-xl shadow-lg text-center space-y-6">
          <h1 className="text-3xl font-bold text-red-600 uppercase">
            ⚠️ Final Warning
          </h1>

          <p className="text-lg font-medium">
            Hi {freelancerName}, you're about to permanently delete your SlotMe
            account.
          </p>

          <SafetyTip />

          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-left space-y-2 text-sm">
            <p className="font-bold text-red-400">
              This will permanently delete:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>All your time slots and availability</li>
              <li>All booking history and appointments</li>
              <li>All services and custom settings</li>
              <li>Your profile and business information</li>
              <li>Any active Stripe subscriptions</li>
            </ul>
          </div>

          <p className="text-base font-bold text-yellow-400">
            THIS CANNOT BE UNDONE.
          </p>

          <div className="flex flex-col items-center pt-4 space-y-4">
            <button
              onClick={() => navigate("/settings")}
              className="btn btn-primary w-full max-w-xs"
            >
              Cancel, Keep My Account
            </button>
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              className="btn btn-error w-full max-w-xs"
            >
              {deleting ? "Deleting..." : "Yes, Delete Forever"}
            </button>
          </div>
        </div>
      </div>

      {/* Final Confirmation Modal */}
      <BaseModal open={showConfirmModal} onClose={handleCloseModal}>
        <div className="text-center space-y-6 text-white">
          <h2 className="text-2xl font-bold text-red-500 uppercase">
            🛑 Final Confirmation
          </h2>

          <p className="text-base font-medium">
            This is your last chance to cancel. To proceed with permanent
            account deletion, type{" "}
            <span className="font-bold text-red-400">delete</span> below.
          </p>

          <input
            type="text"
            className="input input-bordered w-full text-center"
            placeholder='Type "delete" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />

          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={handleCloseModal}
              className="btn btn-outline btn-sm border-white text-white hover:bg-base-300"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={!isConfirmValid || deleting}
              className="btn btn-error btn-sm"
            >
              {deleting ? "Deleting..." : "Confirm Deletion"}
            </button>
          </div>
        </div>
      </BaseModal>
    </>
  );
}
