import { useEffect, useState, useRef } from "react";
import axios from "../../utils/axiosInstance";
import { showToast } from "../../utils/toast";
import { API_BASE } from "../../utils/constants";
import { Link } from "react-router-dom";
import LogoUploadModal from "../Modals/LogoUploadModal";

import { useFreelancer } from "../../context/FreelancerContext"; // Add at the top if not already

const decodeHTMLEntities = (text) => {
  if (!text) return text;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
};

export default function FreelancerBranding({ onUpdate }) {
  const [form, setForm] = useState({
    business_name: "",
    logo_url: "",
    bio: "",
    tagline: "",
    timezone: "",
    no_show_policy: "",
    faq_items: [],
    custom_url: "",
    business_address: "",
    booking_instructions: "",
    preferred_payment_methods: "",
    location: "",
    contact_email: "",
    business_phone: "", // 🔥 CHANGED: Use business_phone instead of phone
    instagram_url: "",
    twitter_url: "",
  });

  const toastLockRef = useRef(0);

  const [error, setError] = useState("");
  const [showLogoModal, setShowLogoModal] = useState(false);

  const next =
    window.location.pathname + window.location.search + window.location.hash;

  const { freelancer, setFreelancer } = useFreelancer();
  const tier = (freelancer?.tier || "free").toLowerCase();
  const canEditCustomURL = tier === "pro" || tier === "elite";
  const initialCustomUrlRef = useRef("");

  const freelancerId = localStorage.getItem("freelancer_id");

  const loadBranding = () => {
    if (!freelancerId) return;

    axios
      .get(`${API_BASE}/freelancer-info`)
      .then((res) => {
        const data = res.data;

        // 🔥 Decode HTML entities when loading into form
        setForm({
          business_name: decodeHTMLEntities(data.business_name) || "",
          logo_url: data.logo_url || "",
          bio: decodeHTMLEntities(data.bio) || "",
          tagline: decodeHTMLEntities(data.tagline) || "",
          timezone: data.timezone || "America/New_York",
          no_show_policy: decodeHTMLEntities(data.no_show_policy) || "",
          faq_items: (data.faq_items || []).map((item) => ({
            question: decodeHTMLEntities(item.question),
            answer: decodeHTMLEntities(item.answer),
          })),
          custom_url: data.custom_url || "",
          business_address: decodeHTMLEntities(data.business_address) || "",
          booking_instructions:
            decodeHTMLEntities(data.booking_instructions) || "",
          preferred_payment_methods:
            decodeHTMLEntities(data.preferred_payment_methods) || "",
          location: decodeHTMLEntities(data.location) || "",
          contact_email: data.contact_email || data.email || "",
          business_phone: data.business_phone || "", // 🔥 CHANGED: Load business_phone
          instagram_url: data.instagram_url || "",
          twitter_url: data.twitter_url || "",
        });
        initialCustomUrlRef.current = data.custom_url || "";

        localStorage.setItem("branding_updated", Date.now());
      })
      .catch((err) => {
        console.error("❌ Failed to load freelancer info", err);
        setError("Failed to load freelancer info");
      });
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return; // Prevent background API spam

    loadBranding();
  }, [freelancerId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: name === "custom_url" ? value.toLowerCase() : value,
    });
  };

  const isValidSlug = (slug) => /^[a-z0-9_-]{3,30}$/.test(slug);

  const handleSave = (e) => {
    e.preventDefault();
    

    if (form.custom_url && !isValidSlug(form.custom_url)) {
      showToast(
        "❌ Invalid custom URL. Use 3–30 letters, numbers, dashes or underscores.",
        "error"
      );
      return;
    }

    const trimmedForm = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim?.() ?? value])
    );

    // If not allowed, never send a different custom_url
    const payload = { ...trimmedForm };
    if (!canEditCustomURL) {
      payload.custom_url = initialCustomUrlRef.current || "";
    }

    axios
      .patch(`${API_BASE}/freelancer/branding`, payload)
      .then(() => {
        showToast("Branding updated!", "success");

        setFreelancer((prev) => ({
          ...(prev || {}),
          custom_url: payload.custom_url,
          business_name: form.business_name,
          logo_url: form.logo_url,
          tagline: form.tagline,
          bio: form.bio,
          timezone: form.timezone,
          no_show_policy: form.no_show_policy,
          faq_items: form.faq_items,
          business_address: form.business_address,
          booking_instructions: form.booking_instructions,
          preferred_payment_methods: form.preferred_payment_methods,
          location: form.location,
          contact_email: form.contact_email,
          business_phone: form.business_phone, // 🔥 CHANGED: Update business_phone
          instagram_url: form.instagram_url,
          twitter_url: form.twitter_url,
        }));

        // keep the form’s slug in sync with what actually got saved
        setForm((prev) => ({ ...prev, custom_url: payload.custom_url }));

        if (onUpdate) onUpdate();
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.error || "❌ Failed to update branding";
        console.error("❌ Failed to update branding", err);
        showToast(msg, "error");
      });
  };

  

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h2 className="text-xl font-bold text-center">Branding Preferences</h2>
      <form
        onSubmit={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.type !== "submit") {
            e.preventDefault();
          }
        }}
        className="space-y-4"
      >
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
        <div className="space-y-1.5">
          <label className="label text-sm text-white !py-0 block">
            Custom Booking URL
          </label>
          {!canEditCustomURL && (
            <Link
              to={`/upgrade#elite?need=pro&next=${encodeURIComponent(next)}`}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full
                 bg-primary text-white border-none
                 shadow-sm hover:bg-primary/90 transition"
            >
              <span aria-hidden>🔒</span>
              <span>Requires PRO (also in ELITE)</span>
            </Link>
          )}

          <div className="relative">
            <input
              type="text"
              name="custom_url"
              value={form.custom_url}
              onChange={handleChange}
              placeholder="e.g. ambercutz"
              className={`input input-bordered w-full !mt-0 ${
                !canEditCustomURL
                  ? "opacity-60 cursor-not-allowed select-none"
                  : ""
              }`}
              readOnly={!canEditCustomURL}
              onClick={() => {
                if (!canEditCustomURL) {
                  const now = Date.now();
                  if (now - toastLockRef.current > 1200) {
                    toastLockRef.current = now;
                    showToast(
                      <span>
                        Custom URL is a PRO feature (also in ELITE).{" "}
                        <a
                          href={`/upgrade#elite?need=pro&next=${encodeURIComponent(
                            next
                          )}`}
                          className="underline font-medium"
                        >
                          Upgrade →
                        </a>
                      </span>,
                      "error"
                    );
                  }
                }
              }}
            />
            {!canEditCustomURL && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-60"
                title="Upgrade to set a custom URL"
              >
                🔒
              </span>
            )}
          </div>

          {form.custom_url && !isValidSlug(form.custom_url) ? (
            <p className="text-[11px] text-red-400">
              Use 3–30 letters, numbers, dashes or underscores.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-300">
              Your booking page will be:{" "}
              <code className="font-mono text-zinc-100">
                {form.custom_url
                  ? `${window.location.origin}/${form.custom_url}`
                  : `${window.location.origin}/book/${freelancer?.id || "..."}`}
              </code>
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm text-white block">
            Logo / Profile Photo:
          </label>
          <button
            type="button"
            className="btn btn-sm bg-white text-black border border-gray-300 hover:bg-gray-100 w-fit shadow-sm transition"
            onClick={() => setShowLogoModal(true)}
          >
            {form.logo_url ? "Change Logo" : "Upload Logo"}
          </button>
        </div>
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
        {/* ——— Contact & Social ——— */}
        <label className="label text-sm text-white">Contact Email:</label>
        <input
          type="email"
          name="contact_email"
          value={form.contact_email}
          onChange={handleChange}
          placeholder="you@domain.com"
          className="input input-bordered w-full"
        />
        <label className="label text-sm text-white">
          Business Phone (Public):
        </label>
        <input
          type="tel"
          name="business_phone"
          value={form.business_phone}
          onChange={handleChange}
          placeholder="+1 (555) 123‑4567"
          className="input input-bordered w-full"
        />
        <label className="label text-sm text-white">
          Instagram URL (optional):
        </label>
        <input
          type="url"
          name="instagram_url"
          value={form.instagram_url}
          onChange={handleChange}
          placeholder="https://instagram.com/yourhandle"
          className="input input-bordered w-full"
        />
        <label className="label text-sm text-white">
          Twitter/X URL (optional):
        </label>
        <input
          type="url"
          name="twitter_url"
          value={form.twitter_url}
          onChange={handleChange}
          placeholder="https://x.com/yourhandle"
          className="input input-bordered w-full"
        />
        {/* ——— Booking Details ——— */}
        <label className="label text-sm text-white">
          Location (city or remote):
        </label>
        <input
          type="text"
          name="location"
          value={form.location}
          onChange={handleChange}
          placeholder="Atlanta, GA or Remote"
          className="input input-bordered w-full"
        />
        <label className="label text-sm text-white">
          Booking Instructions:
        </label>
        <textarea
          name="booking_instructions"
          value={form.booking_instructions}
          onChange={handleChange}
          placeholder="What to prepare, how to join the call, repo access, etc."
          className="textarea textarea-bordered w-full"
        />
        <label className="label text-sm text-white">
          Preferred Payment Methods:
        </label>
        <input
          type="text"
          name="preferred_payment_methods"
          value={form.preferred_payment_methods}
          onChange={handleChange}
          placeholder="Card (Stripe), PayPal, CashApp"
          className="input input-bordered w-full"
        />
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">FAQs</h3>

          {form.faq_items.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              No FAQs yet. Add one to help customers!
            </div>
          ) : (
            <div className="space-y-3">
              {form.faq_items.map((item, index) => (
                <div
                  key={index}
                  className="bg-base-200/50 border border-gray-700 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Question {index + 1}
                    </span>
                    <button
                      type="button"
                      className="btn btn-xs bg-red-600 hover:bg-red-700 text-white border-none"
                      onClick={() => {
                        const updated = form.faq_items.filter(
                          (_, i) => i !== index
                        );
                        setForm({ ...form, faq_items: updated });
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => {
                      const updated = [...form.faq_items];
                      updated[index].question = e.target.value;
                      setForm({ ...form, faq_items: updated });
                    }}
                    placeholder="Question"
                    className="input input-bordered w-full bg-base-100"
                  />

                  <textarea
                    value={item.answer}
                    onChange={(e) => {
                      const updated = [...form.faq_items];
                      updated[index].answer = e.target.value;
                      setForm({ ...form, faq_items: updated });
                    }}
                    placeholder="Answer"
                    rows={3}
                    className="textarea textarea-bordered w-full bg-base-100 resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white border-none w-full"
            onClick={() =>
              setForm({
                ...form,
                faq_items: [...form.faq_items, { question: "", answer: "" }],
              })
            }
          >
            + Add FAQ
          </button>
        </div>
        <button type="submit" className="btn btn-primary w-full">
          Save Changes
        </button>
      </form>
      {error && (
        <div className="p-2 bg-red-100 text-red-600 rounded text-sm text-center">
          {error}
        </div>
      )}

      <LogoUploadModal
        show={showLogoModal}
        onClose={() => setShowLogoModal(false)}
        currentLogo={form.logo_url} // ✅ NEW
        onUploadComplete={async (url) => {
          setForm((prev) => ({ ...prev, logo_url: url }));
          try {
            await axios.patch(`${API_BASE}/freelancer/branding`, {
              logo_url: url,
            });
            setFreelancer((prev) => ({ ...(prev || {}), logo_url: url }));
            showToast("Logo uploaded and saved successfully!", "success");
          } catch (err) {
            console.error("❌ Failed to auto-save logo", err);
            showToast("❌ Failed to auto-save logo", "error");
          }
        }}
      />
    </div>
  );
}
