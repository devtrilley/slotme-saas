import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function PrioritySupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();
  const freelancerId = localStorage.getItem("freelancer_id");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await axios.post("http://127.0.0.1:5000/freelancer/support", {
        subject,
        message,
      }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        }
      });

      setStatus("success");
      setSubject("");
      setMessage("");
    } catch (err) {
      console.error("❌ Support request failed:", err);
      setStatus("error");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4 text-white">
      <h1 className="text-xl font-bold">Priority Support</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Subject"
          className="w-full p-2 rounded bg-white/10 text-white"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
        <textarea
          placeholder="Your message"
          className="w-full p-2 rounded bg-white/10 text-white h-28"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending..." : "Send Request"}
        </button>
        {status === "success" && (
          <p className="text-green-400 text-sm">✅ Sent successfully!</p>
        )}
        {status === "error" && (
          <p className="text-red-400 text-sm">❌ Failed to send support request.</p>
        )}
      </form>

      <button onClick={() => navigate("/freelancer-admin")} className="text-sm mt-4 text-blue-400">
        ← Back to Admin
      </button>
    </div>
  );
}