export default function TermsAndPrivacy() {
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-10 text-white">
      {/* Terms of Service */}
      <section>
        <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>

        <p>
          Welcome to SlotMe. By accessing or using our platform, you agree to be
          bound by these Terms of Service. If you do not agree to these terms,
          you may not use SlotMe.
        </p>

        <h2 className="text-xl font-semibold mt-6">1. Use of Platform</h2>
        <p>
          SlotMe provides a scheduling and booking platform for freelancers and
          their customers. You must be at least 13 years old to use the service.
          Freelancers are responsible for the accuracy of their availability,
          services, and any transactions outside the platform.
        </p>

        <h2 className="text-xl font-semibold mt-6">2. Account Registration</h2>
        <p>
          Freelancers must provide accurate and complete information during
          account creation. You are responsible for maintaining the security of
          your login credentials and for all activities that occur under your
          account.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Appointment Bookings</h2>
        <p>
          Customers may book available time slots provided by freelancers. All
          bookings are subject to confirmation. SlotMe is not responsible for
          cancellations, delays, or service quality.
        </p>
        <p className="mt-2">
          Freelancers reserve the right to cancel any appointment for any reason
          at their discretion. If a booking is cancelled by the freelancer, the
          time slot will become available for others to book.
        </p>

        <h2 className="text-xl font-semibold mt-6">4. Payments</h2>
        <p>
          Payments may be processed through third-party services (e.g., Cash
          App, Zelle, Stripe, etc.). SlotMe does not store or handle payment
          information and cannot assist with refunds or payment disputes.
        </p>
        <p className="mt-2">
          All transactions are the sole responsibility of the freelancer and
          customer involved. If you require a refund or encounter a problem,
          please contact the freelancer directly.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Termination</h2>
        <p>
          We reserve the right to suspend or terminate access to SlotMe at any
          time for violating these terms or engaging in harmful conduct.
        </p>

        <h2 className="text-xl font-semibold mt-6">6. Changes</h2>
        <p>
          SlotMe may update these Terms of Service at any time. Continued use of
          the platform constitutes acceptance of any changes.
        </p>

        <p className="text-sm italic text-white/70 mt-8">
          SlotMe acts solely as a scheduling tool and holds no liability for
          payments, cancellations, or disputes between users. Each freelancer
          defines their own policies, pricing, and responsibilities.
        </p>

        <p className="text-sm text-gray-500 mt-2">
          Last updated: November 2025
        </p>
      </section>

      <hr className="border-gray-700 my-10" />

      {/* Privacy Policy */}
      <section>
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>

        <p>
          Your privacy is important to us. This Privacy Policy explains how we
          collect, use, and protect your information when you use SlotMe.
        </p>

        <h2 className="text-xl font-semibold mt-6">
          1. Information We Collect
        </h2>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Name, email, and phone number (from customers and freelancers)
          </li>
          <li>Booking details and time slot preferences</li>
          <li>Login and account information (freelancers only)</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">
          2. How We Use Your Information
        </h2>
        <p>We use your information to:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>Facilitate bookings and appointments</li>
          <li>Send confirmation emails and updates</li>
          <li>Improve the performance and reliability of our platform</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">3. Data Sharing</h2>
        <p>We do not sell or share your personal info except to:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>Facilitate payment processing</li>
          <li>Comply with legal obligations</li>
          <li>Protect against fraud or abuse</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">4. Security</h2>
        <p>
          We implement industry-standard measures to protect your data, but no
          method is 100% secure. Use SlotMe at your own risk.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Your Rights</h2>
        <p>
          You may request access to or deletion of your personal data by
          contacting us at{" "}
          <a
            href="mailto:support@slotme.app"
            className="text-primary underline"
          >
            support@slotme.app
          </a>
          .
        </p>

        <p className="text-sm text-gray-500 mt-2">
          Last updated: November 2025
        </p>
      </section>
    </main>
  );
}
