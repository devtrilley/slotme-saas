import { useState, useEffect } from "react";
import { RefreshCcw } from "lucide-react";

export default function ResendButton({
  onResend,
  cooldownSeconds = 60,
  className = "",
}) {
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleClick = async () => {
    if (cooldown > 0 || isSending) return;

    setIsSending(true);
    try {
      await onResend();
      setCooldown(cooldownSeconds);
    } catch (err) {
      // Error already handled in parent
    } finally {
      setIsSending(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={cooldown > 0 || isSending}
      className={`btn btn-primary w-full ${
        cooldown > 0 || isSending ? "btn-disabled opacity-70" : ""
      } ${className}`}
    >
      <RefreshCcw className="w-4 h-4" />
      {isSending
        ? "Sending..."
        : cooldown > 0
        ? `Resend in ${cooldown}s`
        : "Resend Verification Email"}
    </button>
  );
}
