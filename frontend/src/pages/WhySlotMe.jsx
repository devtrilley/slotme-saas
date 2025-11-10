import { Link } from "react-router-dom";
import slotmeLogo from "../assets/slotme-logo.svg";

export default function WhySlotMe() {
  return (
    <main className="min-h-screen bg-base-100">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16 text-center space-y-6">
        <img
          src={slotmeLogo}
          alt="SlotMe"
          className="mx-auto w-36 sm:w-40 md:w-48 animate-pulse"
        />

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
          <span className="text-white">Stop Losing Clients to</span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] to-[#6366F1] animate-gradient">
            Booking Friction
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Freelancers lose{" "}
          <span className="text-red-400 font-bold text-xl">40%</span> of bookings to{" "}
          <span className="text-gray-100 font-semibold text-[1.1rem]">
            complicated scheduling
          </span>
          . SlotMe fixes that with{" "}
          <span className="text-purple-400 font-semibold text-[1.1rem]">
            one-click booking
          </span>{" "}
          —{" "}
          <span className="text-indigo-400 font-semibold text-[1.1rem]">
            no customer accounts
          </span>
          , no friction.
        </p>

        <div className="flex justify-center">
          <Link
            to="/auth"
            className="btn btn-lg text-lg px-8 bg-gradient-to-r from-[#7C3AED] to-[#6366F1] hover:from-purple-700 hover:to-indigo-700 text-white border-none shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-600/60 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            Start Free Today ✨
          </Link>
        </div>

        <p className="text-xs text-gray-500">
          No credit card • Cancel anytime • Built for freelancers
        </p>
      </div>

      {/* Social Proof */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-900/20 to-slate-900 py-8 border-y border-purple-500/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-300 mb-4 font-semibold">
            Trusted by barbers, trainers, coaches, and consultants
          </p>
          <div className="flex justify-center gap-8 text-gray-400 text-xs">
            <span>✓ No setup fees</span>
            <span>✓ Cancel anytime</span>
            <span>✓ Mobile-first</span>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-4xl mx-auto px-6 py-14">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] to-[#6366F1]">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-8 text-center">
          {[
            {
              emoji: "🔗",
              title: "Create Your Link",
              color: "text-purple-400",
              desc: "Sign up in 60 seconds. Add your services. Get your booking page URL.",
            },
            {
              emoji: "📣",
              title: "Share Everywhere",
              color: "text-pink-400",
              desc: "Instagram bio, email signature, QR code — clients book with one tap.",
            },
            {
              emoji: "💵",
              title: "Get Paid",
              color: "text-indigo-400",
              desc: "Stripe-powered subscriptions. Track bookings. Export your client list.",
            },
          ].map(({ emoji, title, color, desc }, i) => (
            <div
              key={i}
              className="space-y-3 bg-slate-900/50 p-6 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300"
            >
              <div className="text-5xl">{emoji}</div>
              <h3 className={`text-lg font-semibold ${color}`}>{title}</h3>
              <p className="text-sm text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-gradient-to-b from-slate-900 to-base-100 py-14">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] to-[#6366F1]">
            Everything You Need
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: "🚫",
                title: "No Customer Accounts",
                color: "border-purple-500",
                text: "Clients book instantly. No sign-up walls killing conversions.",
              },
              {
                icon: "📱",
                title: "Mobile-First",
                color: "border-pink-500",
                text: "90% of bookings happen on phones. SlotMe works perfectly on mobile.",
              },
              {
                icon: "🎨",
                title: "Branded Pages",
                color: "border-indigo-500",
                text: "Custom URLs, logos, colors. Looks like your business, not a template.",
              },
              {
                icon: "💳",
                title: "Stripe Integrated",
                color: "border-purple-500",
                text: "Pro ($20/mo) and Elite ($40/mo) tiers. Simple subscription management.",
              },
            ].map(({ icon, title, color, text }, i) => (
              <div
                key={i}
                className={`bg-slate-900/80 p-6 rounded-xl border ${color}/30 hover:${color}/60 hover:shadow-lg hover:shadow-${color}/30 transition-all duration-300`}
              >
                <h3 className="font-semibold mb-2 text-purple-300">
                  {icon} {title}
                </h3>
                <p className="text-sm text-gray-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-2xl mx-auto px-6 py-14 text-center space-y-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] to-[#6366F1]">
          Ready to Stop Losing Bookings?
        </h2>
        <p className="text-gray-400 text-lg">
          Join freelancers already using SlotMe to automate their scheduling.
        </p>
        <div className="flex justify-center">
          <Link
            to="/auth"
            className="btn btn-lg bg-gradient-to-r from-[#7C3AED] to-[#6366F1] hover:from-purple-700 hover:to-indigo-700 text-white border-none shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-600/60 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            Get Started Free 🚀
          </Link>
        </div>
      </div>

      {/* Back to Home */}
      <div className="border-t border-gray-800 py-8 text-center">
        <Link
          to="/"
          className="link text-sm text-gray-400 hover:text-purple-400 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}