export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>

      <p>
        Your privacy is important to us. This Privacy Policy explains how we
        collect, use, and protect your information when you use SlotMe.
      </p>

      <h2 className="text-xl font-semibold">1. Information We Collect</h2>
      <ul className="list-disc list-inside">
        <li>Name, email, and phone number (from customers and freelancers)</li>
        <li>Booking details and time slot preferences</li>
        <li>Login and account information (freelancers only)</li>
      </ul>

      <h2 className="text-xl font-semibold">2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul className="list-disc list-inside ml-4">
        <li>Facilitate bookings and appointments</li>
        <li>Send confirmation emails and updates</li>
        <li>Improve the performance and reliability of our platform</li>
      </ul>

      <h2 className="text-xl font-semibold">3. Data Sharing</h2>
      <p>We do not sell or share your personal info except to:</p>
      <ul className="list-disc list-inside ml-4">
        <li>Facilitate payment processing</li>
        <li>Comply with legal obligations</li>
        <li>Protect against fraud or abuse</li>
      </ul>

      <h2 className="text-xl font-semibold">4. Security</h2>
      <p>
        We implement industry-standard measures to protect your data, but no
        method is 100% secure. Use SlotMe at your own risk.
      </p>

      <h2 className="text-xl font-semibold">5. Your Rights</h2>
      <p>
        You may request access to or deletion of your personal data by
        contacting us at support@slotme.app.
      </p>

      <p className="text-sm text-gray-500">Last updated: May 2025</p>
    </div>
  );
}
