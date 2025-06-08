// src/pages/EmailConfirmed.jsx
import { CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function EmailConfirmed() {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      <CheckCircle className="text-green-400 w-12 h-12 mx-auto" />
      <h1 className="text-2xl font-bold">Email Verified!</h1>
      <p className="text-purple-300">
        You're all set. You can now log in and start using SlotMe.
      </p>
      <button
        onClick={() => navigate("/auth")}
        className="mt-4 text-sm text-blue-400 hover:underline"
      >
        ← Go to Login
      </button>
    </div>
  );
}