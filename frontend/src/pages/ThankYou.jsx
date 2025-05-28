import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import NoShowPolicy from "../components/NoShowPolicy";

export default function ThankYou() {
  const { freelancerId } = useParams();
  const [noShowPolicy, setNoShowPolicy] = useState("");

  useEffect(() => {
    if (!freelancerId) return;
    axios
      .get(`http://127.0.0.1:5000/freelancers/${freelancerId}`)
      .then((res) => setNoShowPolicy(res.data.no_show_policy || ""))
      .catch((err) => console.error("❌ Failed to load policy", err));
  }, [freelancerId]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4 text-center">
      <h1 className="text-3xl font-bold text-success">✅ Booking Confirmed!</h1>
      <p className="text-gray-400">
        Thanks for verifying. See you at your appointment!
      </p>

      <NoShowPolicy policy={noShowPolicy} />
    </div>
  );
}