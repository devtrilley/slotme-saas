import { useState } from "react";

export default function EditFreelancerModal({ freelancer, onClose, onSubmit }) {
  const [form, setForm] = useState({
    first_name: freelancer.first_name || "",
    last_name: freelancer.last_name || "",
    business_name: freelancer.business_name || "",
    email: freelancer.email || "",
    tagline: freelancer.tagline || "",
    bio: freelancer.bio || "",
    location: freelancer.location || "",
    phone: freelancer.phone || "",
    timezone: freelancer.timezone || "America/New_York",
    tier: freelancer.tier || "free",
    logo_url: freelancer.logo_url || "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1000] p-4">
      {/* 🔥 Modal container with flex layout */}
      <div className="bg-base-200 rounded-xl shadow-md w-full max-w-md max-h-[90vh] flex flex-col">
        {/* 🔥 Sticky header - stays at top */}
        <div className="bg-base-200 p-4 border-b border-base-300 rounded-t-xl z-10">
          <h3 className="text-xl font-bold text-center">Edit Freelancer</h3>
        </div>

        {/* 🔥 Scrollable content area */}
        <div className="overflow-y-auto flex-1 p-4">
          <form
            id="edit-freelancer-form"
            onSubmit={handleSubmit}
            className="space-y-3"
          >
            <div>
              <label className="label label-text text-xs">First Name</label>
              <input
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>

            <div>
              <label className="label label-text text-xs">Last Name</label>
              <input
                type="text"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>

            <div>
              <label className="label label-text text-xs">Business Name</label>
              <input
                type="text"
                name="business_name"
                value={form.business_name}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div>
              <label className="label label-text text-xs">Email (Login)</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
                required
              />
            </div>

            <div>
              <label className="label label-text text-xs">Tagline</label>
              <input
                type="text"
                name="tagline"
                value={form.tagline}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
                maxLength={100}
              />
            </div>

            <div>
              <label className="label label-text text-xs">Bio</label>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleChange}
                className="textarea textarea-bordered textarea-sm w-full"
                rows="3"
                maxLength={500}
              />
            </div>

            <div>
              <label className="label label-text text-xs">Location</label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div>
              <label className="label label-text text-xs">Phone</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div>
              <label className="label label-text text-xs">Timezone</label>
              <select
                name="timezone"
                value={form.timezone}
                onChange={handleChange}
                className="select select-bordered select-sm w-full"
              >
                <option value="America/New_York">Eastern (New York)</option>
                <option value="America/Chicago">Central (Chicago)</option>
                <option value="America/Denver">Mountain (Denver)</option>
                <option value="America/Phoenix">Arizona (Phoenix)</option>
                <option value="America/Los_Angeles">
                  Pacific (Los Angeles)
                </option>
              </select>
            </div>

            <div>
              <label className="label label-text text-xs">Tier</label>
              <select
                name="tier"
                value={form.tier}
                onChange={handleChange}
                className="select select-bordered select-sm w-full"
              >
                <option value="free">🆓 Free</option>
                <option value="pro">💎 Pro</option>
                <option value="elite">⭐ Elite</option>
              </select>
            </div>

            <div>
              <label className="label label-text text-xs">Logo URL</label>
              <input
                type="url"
                name="logo_url"
                value={form.logo_url}
                onChange={handleChange}
                className="input input-bordered input-sm w-full"
              />
            </div>
          </form>
        </div>

        {/* 🔥 Sticky footer - always visible at bottom */}
        <div className="bg-base-200 p-4 border-t border-base-300 rounded-b-xl">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm flex-1"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-freelancer-form"
              className="btn btn-primary btn-sm flex-1"
            >
              ✅ Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
