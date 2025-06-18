import { useEffect, useState } from "react";
import axios from "axios";
import { showToast } from "../utils/toast";
import { API_BASE } from "../utils/constants";

export default function FreelancerBranding({ onUpdate }) {
  const [form, setForm] = useState({
    business_name: "",
    logo_url: "",
    bio: "",
    tagline: "",
    timezone: "", // ✅ New
    no_show_policy: "",
    faq_text: "",
    custom_url: "", // ✅ Add this line
    business_address: "", // ✅ New
  });

  const freelancerId = localStorage.getItem("freelancer_id");

  const loadBranding = () => {
    if (!freelancerId) return;

    axios
      .get(`${API_BASE}/freelancer-info`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      .then((res) => {
        const {
          business_name,
          logo_url,
          bio,
          tagline,
          timezone,
          no_show_policy,
          faq_text,
          business_address, // ✅ Add this
        } = res.data;
        setForm({
          business_name: business_name || "",
          logo_url: logo_url || "",
          bio: bio || "",
          tagline: tagline || "",
          timezone: timezone || "America/New_York", // ✅ default fallback
          no_show_policy: no_show_policy || "",
          faq_text: faq_text || "",
          custom_url: res.data.custom_url || "", // ✅ Add this line
          business_address: business_address || "", // ✅ Add this
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
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: name === "custom_url" ? value.toLowerCase() : value,
    });
  };

  const isValidSlug = (slug) => /^[a-z0-9_-]{3,30}$/i.test(slug);

  const handleSave = (e) => {
    e.preventDefault();
    console.log("🔁 Submitting form:", form);

    if (!isValidSlug(form.custom_url)) {
      showToast(
        "❌ Invalid custom URL. Use 3–30 letters, numbers, dashes or underscores.",
        "error"
      );
      return;
    }

    axios
      .patch(`${API_BASE}/freelancer/branding`, form, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      })
      .then(() => {
        showToast("✅ Branding updated!", "success");
        if (onUpdate) onUpdate();
      })
      .catch((err) => {
        console.error("❌ Failed to update branding", err);
        showToast("❌ Failed to update branding", "error");
      });
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-xl font-bold text-center">Branding Preferences</h2>

      <form onSubmit={handleSave} className="space-y-4">
        <label className="label text-sm text-white">Business Name:</label>
        <input
          type="text"
          name="business_name"
          value={form.business_name}
          onChange={handleChange}
          placeholder="Business Name"
          className="input input-bordered w-full"
        />

        <label className="label text-sm text-white">
          Business Address (if applicable):
        </label>
        <input
          type="text"
          name="business_address"
          value={form.business_address}
          onChange={handleChange}
          placeholder="e.g. 123 Main St, Atlanta, GA"
          className="input input-bordered w-full"
        />

        <label className="label text-sm text-white">Custom Booking URL:</label>
        <input
          type="text"
          name="custom_url"
          value={form.custom_url}
          onChange={handleChange}
          placeholder="e.g. ambercutz"
          className="input input-bordered w-full"
        />
        {form.custom_url && !isValidSlug(form.custom_url) ? (
          <p className="text-xs text-red-400 mt-1">
            Only 3–30 characters: letters, numbers, dashes (-) or underscores
            (_)
          </p>
        ) : (
          <p className="text-xs text-white mt-1">
            Your booking page will be available at:{" "}
            <strong>slotme.com/{form.custom_url || "<custom_url>"}</strong>
          </p>
        )}

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
