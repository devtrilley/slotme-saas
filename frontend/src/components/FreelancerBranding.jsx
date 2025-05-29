import { useEffect, useState } from "react";
import axios from "axios";

export default function FreelancerBranding({ onUpdate }) {
  const [form, setForm] = useState({
    name: "",
    logo_url: "",
    bio: "",
    tagline: "",
    timezone: "", // ✅ New
    no_show_policy: "",
    faq_text: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const freelancerId = localStorage.getItem("freelancer_id");

  const loadBranding = () => {
    if (!freelancerId) return;

    axios
      .get("http://127.0.0.1:5000/freelancer-info", {
        headers: { "X-Freelancer-ID": freelancerId },
      })
      .then((res) => {
        const { name, logo_url, bio, tagline, timezone, no_show_policy } =
          res.data;
        setForm({
          name: name || "",
          logo_url: logo_url || "",
          bio: bio || "",
          tagline: tagline || "",
          timezone: timezone || "America/New_York", // ✅ default fallback
          no_show_policy: no_show_policy || "",
          faq_text: faq_text || "",
        });

        localStorage.setItem("branding_updated", Date.now());
      })
      .catch((err) => {
        console.error("❌ Failed to load freelancer info", err);
        setError("Failed to load freelancer info");
      });
  };

  useEffect(() => {
    loadBranding();
  }, [freelancerId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    axios
      .patch("http://127.0.0.1:5000/freelancer/branding", form, {
        headers: { "X-Freelancer-ID": freelancerId },
      })
      .then(() => {
        setMessage("Branding updated!");
        if (onUpdate) onUpdate();
      })
      .catch((err) => {
        console.error("❌ Failed to update branding", err);
        setError("Failed to update branding");
      });
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-xl font-bold text-center">Branding Preferences</h2>

      {message && <p className="text-green-500 text-center">{message}</p>}
      {error && <p className="text-red-500 text-center">{error}</p>}

      <form onSubmit={handleSave} className="space-y-4">
        <label className="label text-sm text-white">Business Name:</label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Business Name"
          className="input input-bordered w-full"
        />

        <label className="label text-sm text-white">Logo URL: (optional)</label>
        <input
          type="url"
          name="logo_url"
          value={form.logo_url}
          onChange={handleChange}
          placeholder="Logo URL (optional)"
          className="input input-bordered w-full"
        />

        <label className="label text-sm text-white">Tagline: (optional)</label>
        <input
          type="text"
          name="tagline"
          value={form.tagline}
          onChange={handleChange}
          placeholder="Tagline (optional)"
          className="input input-bordered w-full"
        />

        <label className="label text-sm text-white">Bio / Description:</label>
        <textarea
          name="bio"
          value={form.bio}
          onChange={handleChange}
          placeholder="Short bio or description"
          className="textarea textarea-bordered w-full"
        />

        <label className="label text-sm text-white">Timezone:</label>
        {/* ✅ Timezone Selector */}
        <select
          name="timezone"
          value={form.timezone}
          onChange={handleChange}
          className="select select-bordered w-full"
        >
          <option value="America/New_York">Eastern (EST)</option>
          <option value="America/Chicago">Central (CST)</option>
          <option value="America/Denver">Mountain (MST)</option>
          <option value="America/Los_Angeles">Pacific (PST)</option>
        </select>

        <label className="label text-sm text-white">No-Show Policy:</label>
        <textarea
          name="no_show_policy"
          value={form.no_show_policy}
          onChange={handleChange}
          placeholder="No-show policy (e.g. late fees, cancellation terms)"
          className="textarea textarea-bordered w-full"
        />

        <label className="label text-sm text-white">
          FAQ or Additional Info:
        </label>
        <textarea
          name="faq_text"
          value={form.faq_text}
          onChange={handleChange}
          placeholder="Any deposits, policies, common questions, etc."
          className="textarea textarea-bordered w-full"
        />

        <button type="submit" className="btn btn-primary w-full">
          Save Changes
        </button>
      </form>
    </div>
  );
}

// https://m.media-amazon.com/images/M/MV5BMjA5Njg3NDkxNV5BMl5BanBnXkFtZTgwNDczMTgyODE@._V1_.jpg
