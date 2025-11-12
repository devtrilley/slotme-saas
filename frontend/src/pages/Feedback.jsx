import { useState } from "react";
import axios from "../utils/axiosInstance";
import { MessageSquare } from "lucide-react";
import { showToast } from "../utils/toast";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/constants";

export default function Feedback() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState(""); // Optional for public users
  const [reason, setReason] = useState("General");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const payload = {
        name,
        email,
        subject,
        message,
        reason,
      };

      const headers = {
        "Content-Type": "application/json",
      };

      await axios.post(`${API_BASE}/feedback`, payload, { headers });

      setStatus("success");
      showToast("Feedback sent successfully!", "success");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      console.error("❌ Feedback failed:", err);
      setStatus("error");
      showToast("❌ Failed to send feedback. Please try again.", "error");
    }
  };

  return (
    <main className="max-w-md mx-auto p-6 space-y-5 text-white" role="main">
      <div className="flex items-center space-x-2">
        <MessageSquare className="text-purple-400" />
        <h1 className="text-xl font-bold">Feedback</h1>
      </div>
      <p className="text-sm text-purple-300 ml-6 -mt-2">
        We value your thoughts — let us know how we're doing.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1 text-white/70">
            Reason for Contact
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
          >
            <option>General</option>
            <option>Bug Report</option>
            <option>Feature Request</option>
            <option>Partnership</option>
            <option>Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1 text-white/70">
            Your Name (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Sarah M."
            className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-white/70">Your Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-white/70">Subject</label>
          <input
            type="text"
            placeholder="Subject line"
            className="w-full p-3 rounded bg-white/10 text-white border border-white/20"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-white/70">Message</label>
          <textarea
            placeholder="Write your feedback here..."
            className="w-full p-3 rounded bg-white/10 text-white border border-white/20 h-28"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 px-4 rounded bg-purple-600 hover:bg-purple-700 transition disabled:opacity-50"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending..." : "Send Feedback"}
        </button>
      </form>

      <button
        onClick={() => navigate("/")}
        className="text-sm mt-4 text-blue-400 hover:underline"
      >
        ← Back to Home
      </button>
    </main>
  );
}
