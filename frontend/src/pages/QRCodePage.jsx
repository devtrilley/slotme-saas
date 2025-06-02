import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";

export default function QRCodePage() {
  const [freelancerId, setFreelancerId] = useState(null);
  const [qrUrl, setQrUrl] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const id = localStorage.getItem("freelancer_id");
    if (!id) return navigate("/login");
    setFreelancerId(id);
    setQrUrl(`https://slotme.com/resolve?id=${id}`);
  }, [navigate]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      alert("Copied to clipboard!");
    } catch {
      alert("Failed to copy link.");
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 p-6 py-2 bg-base-200 rounded-xl shadow-lg space-y-6 text-center">
      <h2 className="text-xl font-semibold tracking-tight text-primary">
        📱 Book Me Instantly
      </h2>

      <div className="inline-block p-4 bg-white rounded-xl shadow border-4 border-primary">
        {qrUrl && <QRCodeSVG value={qrUrl} size={180} />}
      </div>

      <p className="text-sm text-gray-500 break-all">{qrUrl}</p>

      <button
        className="btn btn-primary btn-sm w-full gap-2"
        onClick={copyLink}
      >
        🔗 Copy My Link
      </button>
    </div>
  );
}
