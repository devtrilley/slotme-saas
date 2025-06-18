import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { API_BASE } from "../utils/constants";

export default function PrioritySupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    try {
      await axios.post(
        `${API_BASE}/freelancer/support`,
        {
          subject,
          message,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      setStatus("success");
      setSubject("");
      setMessage("");
    } catch (err) {
      console.error("❌ Support request failed:", err);
      setStatus("error");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-5 text-white">
      <div className="flex items-center space-x-2">
        <MessageSquare className="text-purple-400" />
        <h1 className="text-xl font-bold">Priority Support</h1>
      </div>
      <p className="text-sm text-purple-300 ml-6 -mt-2 italic">
        Exclusive access for Elite members only
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="subject" className="block text-sm text-white mb-1">
            Subject
          </label>
          <input
            id="subject"
            type="text"
            placeholder="Subject"
            className="w-full p-3 rounded bg-white/10 text-white border border-white/20 placeholder-white/50"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm text-white mb-1">
            Message
          </label>
          <textarea
            id="message"
            placeholder="Describe your issue in detail..."
            className="w-full p-3 rounded bg-white/10 text-white border border-white/20 h-28 placeholder-white/50"
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
          {status === "loading" ? "Sending..." : "Send Request"}
        </button>

        {status === "success" && (
          <p className="text-green-400 text-sm">✅ Sent successfully!</p>
        )}
        {status === "error" && (
          <p className="text-red-400 text-sm">
            ❌ Failed to send support request.
          </p>
        )}
      </form>

      <button
        onClick={() => navigate("/freelancer-admin")}
        className="text-sm mt-4 text-blue-400 hover:underline"
      >
        ← Back to Admin
      </button>
    </div>
  );
}