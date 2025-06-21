import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";

export default function QRCodePage() {
  const [freelancerId, setFreelancerId] = useState(null);
  const [qrUrl, setQrUrl] = useState("");
  const navigate = useNavigate();
  const qrRef = useRef();

  useEffect(() => {
    const id = localStorage.getItem("freelancer_id");
    if (!id) return navigate("/login");
    setFreelancerId(id);

    const fetchUrl = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/freelancer/public-info/${id}`
        );
        const data = await res.json();

        const base = import.meta.env.VITE_PUBLIC_URL;
        const link = data.custom_url
          ? `${base}/${data.custom_url}`
          : `${base}/freelancers/${id}`;

        setQrUrl(link);
      } catch (err) {
        alert("❌ Failed to fetch public link. Please try again.");
      }
    };

    fetchUrl();
  }, [navigate]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      alert("Copied to clipboard!");
    } catch {
      alert("Failed to copy link.");
    }
  };

  const downloadQR = () => {
    const svg = qrRef.current.querySelector("svg");
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = "slotme-qr.png";
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="max-w-sm mx-auto mt-10 p-6 py-2 bg-base-200 rounded-xl shadow-lg space-y-6 text-center">
      <h2 className="text-xl font-semibold tracking-tight text-primary">
        📱 Book Me Instantly
      </h2>

      <div
        ref={qrRef}
        className="inline-block p-4 bg-white rounded-xl shadow border-4 border-primary"
      >
        {qrUrl && <QRCodeSVG value={qrUrl} size={180} />}
      </div>

      <p className="text-xs text-gray-400">Or share this link:</p>
      <code className="text-sm text-gray-500 break-all block">{qrUrl}</code>

      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm flex-1" onClick={copyLink}>
          🔗 Copy My Link
        </button>
        <button className="btn btn-outline btn-sm flex-1" onClick={downloadQR}>
          ⬇️ Download QR
        </button>
      </div>
    </div>
  );
}
