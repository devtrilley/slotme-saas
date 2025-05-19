import { useEffect, useState } from "react";
import axios from "axios";

export default function ClientBranding() {
  const [form, setForm] = useState({
    name: "",
    logo_url: "",
    bio: "",
    tagline: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clientId = localStorage.getItem("client_id");

  useEffect(() => {
    if (!clientId) return;

    axios
      .get("http://127.0.0.1:5000/client-info", {
        headers: { "X-Client-ID": clientId },
      })
      .then((res) => {
        const { name, logo_url, bio, tagline } = res.data;
        setForm({
          name: name || "",
          logo_url: logo_url || "",
          bio: bio || "",
          tagline: tagline || "",
        });
      })
      .catch((err) => {
        console.error("❌ Failed to load client info", err);
        setError("Failed to load client info");
      });
  }, [clientId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    axios
      .patch("http://127.0.0.1:5000/client/branding", form, {
        headers: { "X-Client-ID": clientId },
      })
      .then(() => setMessage("Branding updated!"))
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
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Business Name"
          className="input input-bordered w-full"
        />

        <input
          type="url"
          name="logo_url"
          value={form.logo_url}
          onChange={handleChange}
          placeholder="Logo URL (optional)"
          className="input input-bordered w-full"
        />

        <input
          type="text"
          name="tagline"
          value={form.tagline || ""}
          onChange={handleChange}
          placeholder="Tagline (optional)"
          className="input input-bordered w-full"
        />

        <textarea
          name="bio"
          value={form.bio || ""}
          onChange={handleChange}
          placeholder="Short bio or description"
          className="textarea textarea-bordered w-full"
        />

        <button type="submit" className="btn btn-primary w-full">
          Save Changes
        </button>
      </form>
    </div>
  );
}
