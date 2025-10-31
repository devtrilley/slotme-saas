// src/pages/SignupSuccess.jsx
import { MailCheck, ThumbsUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SignupSuccess() {
  const navigate = useNavigate();

  return (
    <main className="max-w-md mx-auto p-6 space-y-6 text-center text-white">
      <div className="flex flex-col items-center space-y-2">
        <ThumbsUp className="text-green-400 w-12 h-12" />
        <h1 className="text-2xl font-bold">Welcome to SlotMe!</h1>
        <p className="text-purple-300">
          Your sign-up is almost complete. Check your inbox and click the
          verification link to activate your account.
        </p>
      </div>

      <div className="flex items-center justify-center space-x-2 text-sm text-white/60">
        <MailCheck className="w-4 h-4 text-white/60" />
        <span>Didn’t get it? Check your spam folder.</span>
      </div>

      <button
        onClick={() => navigate("/auth")}
        className="mt-4 text-sm text-blue-400 hover:underline"
      >
        ← Go to Login
      </button>
    </main>
  );
}
