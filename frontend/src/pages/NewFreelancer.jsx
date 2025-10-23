import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { API_BASE } from "../utils/constants";

export default function NewFreelancer() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    tier: "free",
    business_name: "",
    timezone: "America/New_York",
    phone: "",
    contact_email: "",
    logo_url: "",
    tagline: "",
    bio: "",
    location: "",
    instagram_url: "",
    twitter_url: "",
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const errors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      errors.email = "Invalid email format";
    }

    // Contact email validation (if provided)
    if (form.contact_email && !emailRegex.test(form.contact_email)) {
      errors.contact_email = "Invalid contact email format";
    }

    // Password validation
    if (form.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    // Phone validation (if provided)
    if (
      form.phone &&
      !/^\d{3}-\d{3}-\d{4}$/.test(form.phone) &&
      !/^\d{10}$/.test(form.phone.replace(/\D/g, ""))
    ) {
      errors.phone = "Phone must be 10 digits (e.g., 555-555-5555)";
    }

    // URL validation for social media (if provided)
    if (form.instagram_url && !form.instagram_url.includes("instagram.com")) {
      errors.instagram_url = "Must be a valid Instagram URL";
    }
    if (
      form.twitter_url &&
      !form.twitter_url.includes("twitter.com") &&
      !form.twitter_url.includes("x.com")
    ) {
      errors.twitter_url = "Must be a valid Twitter/X URL";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setError("Please fix the validation errors");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    // Auto-set contact_email to email if not provided
    const submitData = {
      ...form,
      contact_email: form.contact_email || form.email,
    };

    axios
      .post(`${API_BASE}/dev/freelancers`, submitData)
      .then(() => {
        setSuccess("✅ Freelancer created!");
        setTimeout(() => navigate("/dev-admin"), 1500);
      })
      .catch((err) => {
        console.error("❌ Failed to create freelancer", err);
        setError(err.response?.data?.error || "Error creating freelancer");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold text-center">Add New Freelancer</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-base-300 p-3 rounded-lg">
          <h3 className="font-semibold text-sm mb-2">Required Fields</h3>

          <div className="space-y-2">
            <div>
              <input
                type="text"
                name="first_name"
                placeholder="First Name *"
                value={form.first_name}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>

            <div>
              <input
                type="text"
                name="last_name"
                placeholder="Last Name *"
                value={form.last_name}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>

            <div>
              <input
                type="email"
                name="email"
                placeholder="Login Email *"
                value={form.email}
                onChange={handleChange}
                className={`input input-bordered input-sm w-full ${
                  validationErrors.email ? "input-error" : ""
                }`}
                required
              />
              {validationErrors.email && (
                <p className="text-xs text-error mt-1">
                  {validationErrors.email}
                </p>
              )}
            </div>

            <div>
              <input
                type="password"
                name="password"
                placeholder="Password * (min 6 chars)"
                value={form.password}
                onChange={handleChange}
                className={`input input-bordered input-sm w-full ${
                  validationErrors.password ? "input-error" : ""
                }`}
                required
              />
              {validationErrors.password && (
                <p className="text-xs text-error mt-1">
                  {validationErrors.password}
                </p>
              )}
            </div>

            <div className="relative">
              <select
                name="tier"
                value={form.tier}
                onChange={handleChange}
                className="select select-bordered select-sm w-full"
                required
              >
                <option value="free">🆓 Free Tier</option>
                <option value="pro">💎 Pro Tier ($49/mo)</option>
                <option value="elite">⭐ Elite Tier ($99/mo)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {form.tier === "free" && "5 services, basic analytics"}
                {form.tier === "pro" &&
                  "15 services, advanced analytics, priority support"}
                {form.tier === "elite" &&
                  "Unlimited services, full analytics, white-label"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-base-300 p-3 rounded-lg">
          <h3 className="font-semibold text-sm mb-2">Profile Information</h3>

          <div className="space-y-2">
            <input
              type="text"
              name="business_name"
              placeholder="Business Name (optional)"
              value={form.business_name}
              onChange={handleChange}
              className="input input-bordered input-sm w-full"
            />

            <input
              type="text"
              name="tagline"
              placeholder="Tagline (e.g., 'Fresh fades. Clean lines.')"
              value={form.tagline}
              onChange={handleChange}
              className="input input-bordered input-sm w-full"
              maxLength={100}
            />

            <textarea
              name="bio"
              placeholder="Bio (optional, max 500 chars)"
              value={form.bio}
              onChange={handleChange}
              className="textarea textarea-bordered textarea-sm w-full"
              rows="3"
              maxLength={500}
            />

            <input
              type="text"
              name="location"
              placeholder="Location (e.g., 'Los Angeles, CA')"
              value={form.location}
              onChange={handleChange}
              className="input input-bordered input-sm w-full"
            />

            <input
              type="url"
              name="logo_url"
              placeholder="Logo URL (optional, for testing)"
              value={form.logo_url}
              onChange={handleChange}
              className="input input-bordered input-sm w-full"
            />
          </div>
        </div>

        <div className="bg-base-300 p-3 rounded-lg">
          <h3 className="font-semibold text-sm mb-2">Contact Information</h3>

          <div className="space-y-2">
            <div>
              <input
                type="email"
                name="contact_email"
                placeholder="Public Contact Email (defaults to login email)"
                value={form.contact_email}
                onChange={handleChange}
                className={`input input-bordered input-sm w-full ${
                  validationErrors.contact_email ? "input-error" : ""
                }`}
              />
              {validationErrors.contact_email && (
                <p className="text-xs text-error mt-1">
                  {validationErrors.contact_email}
                </p>
              )}
            </div>

            <div>
              <input
                type="tel"
                name="phone"
                placeholder="Phone (e.g., 555-555-5555)"
                value={form.phone}
                onChange={handleChange}
                className={`input input-bordered input-sm w-full ${
                  validationErrors.phone ? "input-error" : ""
                }`}
              />
              {validationErrors.phone && (
                <p className="text-xs text-error mt-1">
                  {validationErrors.phone}
                </p>
              )}
            </div>

            <select
              name="timezone"
              value={form.timezone}
              onChange={handleChange}
              className="select select-bordered select-sm w-full"
            >
              <option value="America/New_York">🕐 Eastern (New York)</option>
              <option value="America/Chicago">🕑 Central (Chicago)</option>
              <option value="America/Denver">🕒 Mountain (Denver)</option>
              <option value="America/Phoenix">
                🌵 Arizona (Phoenix - No DST)
              </option>
              <option value="America/Los_Angeles">
                🕓 Pacific (Los Angeles)
              </option>
            </select>
          </div>
        </div>

        <div className="bg-base-300 p-3 rounded-lg">
          <h3 className="font-semibold text-sm mb-2">
            Social Media (Optional)
          </h3>

          <div className="space-y-2">
            <div>
              <input
                type="url"
                name="instagram_url"
                placeholder="Instagram URL"
                value={form.instagram_url}
                onChange={handleChange}
                className={`input input-bordered input-sm w-full ${
                  validationErrors.instagram_url ? "input-error" : ""
                }`}
              />
              {validationErrors.instagram_url && (
                <p className="text-xs text-error mt-1">
                  {validationErrors.instagram_url}
                </p>
              )}
            </div>

            <div>
              <input
                type="url"
                name="twitter_url"
                placeholder="Twitter/X URL"
                value={form.twitter_url}
                onChange={handleChange}
                className={`input input-bordered input-sm w-full ${
                  validationErrors.twitter_url ? "input-error" : ""
                }`}
              />
              {validationErrors.twitter_url && (
                <p className="text-xs text-error mt-1">
                  {validationErrors.twitter_url}
                </p>
              )}
            </div>
          </div>
        </div>

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            "✅ Create Freelancer"
          )}
        </button>
      </form>

      {error && <p className="text-red-500 text-center text-sm">{error}</p>}
      {success && (
        <p className="text-green-500 text-center text-sm">{success}</p>
      )}

      <button
        onClick={() => navigate("/dev-admin")}
        className="btn btn-outline w-full mt-4"
      >
        ⬅️ Back to Admin Panel
      </button>
    </div>
  );
}
