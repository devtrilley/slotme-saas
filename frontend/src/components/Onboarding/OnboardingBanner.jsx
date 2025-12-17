import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../utils/axiosInstance";
import { API_BASE } from "../../utils/constants";
import ProgressBar from "../Layout/ProgressBar";

export default function OnboardingBanner({
  freelancer,
  services,
  slots,
  onJumpTo,
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [expandedStepId, setExpandedStepId] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [stepsFromDB, setStepsFromDB] = useState({});
  const [loading, setLoading] = useState(true);
  const [isDismissing, setIsDismissing] = useState(false);
  const [previousCount, setPreviousCount] = useState(0);
  const bannerRef = useRef(null);

  const totalSteps = 7; // ✅ Now 7 steps (added payment info)

  // smooth-ish accordion is now pure CSS (no JS height hacks)

  // Force scroll to top when banner mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Fetch onboarding status from database
  useEffect(() => {
    if (!freelancer?.id) return;

    axios
      .get(`${API_BASE}/onboarding/status`)
      .then((res) => {
        setDismissed(res.data.completed);
        setStepsFromDB(res.data.steps_completed || {});
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch onboarding status:", err);
        setLoading(false);
      });
  }, [freelancer?.id]);

  // Poll for updates every 2 seconds
  useEffect(() => {
    if (!freelancer?.id || dismissed) return;

    const interval = setInterval(() => {
      axios
        .get(`${API_BASE}/onboarding/status`)
        .then((res) => {
          setStepsFromDB(res.data.steps_completed || {});
        })
        .catch((err) => {
          console.error("Failed to poll onboarding status:", err);
        });
    }, 2000);

    return () => clearInterval(interval);
  }, [freelancer?.id, dismissed]);

  // Flash green when step count increases
  useEffect(() => {
    // ✅ Only flash if count increased AND we have a valid previous count
    if (
      completedCount > previousCount &&
      previousCount > 0 &&
      bannerRef.current
    ) {
      const hasFlashedStep6 = localStorage.getItem("onboarding_step6_flashed");

      if (completedCount === totalSteps) {
        // ✅ Final step - flash to permanent green (only once)
        if (!hasFlashedStep6) {
          console.log("🎉 All steps complete - flashing to green");
          localStorage.setItem("onboarding_step6_flashed", "true");
          bannerRef.current.classList.add("flash-to-green");
          setTimeout(() => {
            bannerRef.current?.classList.remove("flash-to-green");
          }, 1200);
        }
      } else {
        // ✅ Regular step - flash green and return to purple
        console.log(`✅ Step ${completedCount} complete - flashing green`);
        bannerRef.current.classList.add("flash-green");
        setTimeout(() => {
          bannerRef.current?.classList.remove("flash-green");
        }, 1200);
      }
    }
    setPreviousCount(completedCount);
  }, [completedCount, previousCount, totalSteps]);

  // Step definitions
  const getStepsList = () => [
    {
      id: 1,
      label: "Welcome to SlotMe!",
      description:
        "SlotMe lets clients book you in seconds — no apps, no accounts, no friction.\n\n" +
        "This quick setup covers:\n" +
        "• Your business profile\n" +
        "• Services and availability\n" +
        "• Your booking link\n\n" +
        'Most people finish in under 5 minutes. Are you ready? Hit "Got it" below to get started!',
      done: stepsFromDB.step1 === true,
      action: null,
      requiresConfirmation: true,
    },
    {
      id: 2,
      label: "How Payments Work",
      description:
        "SlotMe does not process payments or take a percentage of your earnings. \n\n" +
        "You keep 100% of what you make!\n\n" +
        "You choose how clients pay you — Venmo, Cash App, Zelle, cash, cards, or anything else you prefer.\n\n" +
        "Clients pay you directly. SlotMe simply handles scheduling. This lets you be in control of how and when you get paid.",
      done: stepsFromDB.step2 === true,
      action: null,
      requiresConfirmation: true,
    },
    {
      id: 3,
      label: "Complete Your Branding",
      description:
        "This is what clients see before they book.\n\n" +
        "Add your business name, bio, and contact details. We pre-filled your timezone and email — just review them.\n\n" +
        "Complete profiles build trust and get more bookings.",
      done:
        !!freelancer?.business_name &&
        !!freelancer?.tagline &&
        !!freelancer?.bio &&
        !!freelancer?.timezone &&
        !!freelancer?.contact_email &&
        !!freelancer?.location &&
        !!freelancer?.preferred_payment_methods,
      action: () => onJumpTo("branding"),
      fields: [
        { name: "Business Name", done: !!freelancer?.business_name },
        { name: "Logo", done: !!freelancer?.logo_url },
        { name: "Tagline", done: !!freelancer?.tagline },
        { name: "Bio", done: !!freelancer?.bio },
        {
          name: "Timezone (Default EST, change if needed)",
          done: !!freelancer?.timezone,
        },
        {
          name: "Contact Email (Default sign up email, change if needed)",
          done: !!freelancer?.contact_email,
        },
        { name: "Location", done: !!freelancer?.location },
        {
          name: "Payment Methods",
          done: !!freelancer?.preferred_payment_methods,
        },
      ],
    },
    {
      id: 4,
      label: "Add Your First Service",
      description:
        "Clients can't book until you add at least one service.\n\n" +
        "Add a service with a name, price, and duration.\n\n" +
        "Examples by profession:\n" +
        "• Barber: Haircut — $50 (60 min)\n" +
        "• Coach: Consultation — $100 (30 min)\n" +
        "• Esthetician: Facial — $120 (75 min)\n\n" +
        "One service unlocks bookings. You can add more anytime.",
      done: services && services.length > 0,
      action: () => onJumpTo("add-service"),
    },
    {
      id: 5,
      label: "Create Time Slots",
      description:
        "Clients can't book you without open time slots.\n\n" +
        "Choose a date and add individual slots, or use batch mode to create multiple slots at once for recurring availability.\n\n" +
        "One slot is enough to start. You can always add more later.",
      done: slots && slots.length > 0,
      action: () => onJumpTo("add-slots"),
    },
    {
      id: 6,
      label: "Preview Your Booking Page",
      description:
        "Time to see what you just built!\n\n" +
        "This is your live booking page — exactly what clients see when they book you.\n\n" +
        "Click the button below to preview it.",
      done: stepsFromDB.step6 === true,
      action: () => {
        axios.post(`${API_BASE}/onboarding/mark-step/6`).catch((err) => {
          console.error("Failed to mark step 6:", err);
        });
        const bookingUrl = freelancer?.custom_url
          ? `/${freelancer.custom_url}`
          : freelancer?.public_slug
          ? `/${freelancer.public_slug}`
          : `/book/${freelancer?.id}`;
        window.scrollTo({ top: 0, behavior: "instant" });
        setTimeout(() => {
          navigate(bookingUrl);
        }, 50);
      },
    },
    {
      id: 7,
      label: "Share Your Booking Link",
      description:
        "You're live! Clients can book you now.\n\n" +
        "Copy your link and share it anywhere:\n" +
        "• Instagram\n" +
        "• TikTok\n" +
        "• Email\n" +
        "• Your website\n\n" +
        "Every share is a potential booking!",
      done: stepsFromDB.step7 === true,
      action: () => {
        onJumpTo("share-link");
        setTimeout(() => {
          window.scrollBy({ top: 100, behavior: "smooth" });
        }, 300);
      },
    },
  ];

  // Calculate progress
  useEffect(() => {
    if (!freelancer) return;
    const stepsList = getStepsList();
    setSteps(stepsList);
    setCompletedCount(stepsList.filter((s) => s && s.done).length);
  }, [freelancer, services, slots, stepsFromDB]);

  // Handle step 1 confirmation
  const handleStep1Confirm = () => {
    axios
      .post(`${API_BASE}/onboarding/mark-step/1`)
      .then(() => {
        setStepsFromDB((prev) => ({ ...prev, step1: true }));
      })
      .catch((err) => {
        console.error("Failed to mark step 1:", err);
      });
  };

  // Handle step 2 confirmation (payments)
  const handleStep2Confirm = () => {
    axios
      .post(`${API_BASE}/onboarding/mark-step/2`)
      .then(() => {
        setStepsFromDB((prev) => ({ ...prev, step2: true }));
      })
      .catch((err) => {
        console.error("Failed to mark step 2:", err);
      });
  };

  // Handle dismiss with animation
  const handleDismiss = () => {
    setIsDismissing(true);

    axios
      .post(`${API_BASE}/onboarding/dismiss`)
      .then(() => {
        localStorage.setItem("onboarding_completed", "true");
        localStorage.removeItem("onboarding_step6_flashed");
        setTimeout(() => {
          setDismissed(true);
        }, 200);
      })
      .catch((err) => {
        console.error("Failed to dismiss onboarding:", err);
        setIsDismissing(false);
      });
  };

  if (loading || dismissed) return null;

  const allComplete = completedCount === totalSteps;

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      {/* Spacer to prevent content overlap */}
      <div className="transition-all duration-300" style={{ height: "64px" }} />

      <div
        id="onboarding-banner"
        ref={bannerRef}
        className={`fixed left-0 right-0 z-40 top-16 transition-all duration-500 
          rounded-b-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)]
          ${
            isDismissing
              ? "opacity-0 -translate-y-4"
              : "opacity-100 translate-y-0"
          }
          ${
            allComplete
              ? "bg-gradient-to-r from-green-600 to-emerald-600"
              : "bg-gradient-to-r from-purple-600 to-blue-600"
          }`}
      >
        {/* Collapsed view */}
        <button
          onClick={handleToggle}
          className="w-full px-3 py-2 sm:px-4 sm:py-4 md:py-5 md:pt-8 flex items-center justify-between text-white hover:bg-white/10 transition-all duration-200"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl transition-transform duration-300">
              {allComplete ? "✅" : "🎯"}
            </span>
            <div className="text-left">
              <div className="text-sm sm:text-base font-semibold transition-all duration-300">
                {allComplete
                  ? "🎉 Setup Complete! Start booking!"
                  : `Setup Progress: ${completedCount} of ${totalSteps} Completed`}
              </div>
              <div className="text-[11px] sm:text-xs opacity-90">
                {allComplete
                  ? "Click to dismiss or review steps"
                  : isOpen
                  ? "Click to collapse"
                  : "Click to expand checklist"}
              </div>
            </div>
          </div>
          <span
            className={`text-2xl transition-transform duration-300 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          >
            ▼
          </span>
        </button>

        {/* Expanded view */}
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isOpen
              ? "max-h-[70vh] md:max-h-[500px] opacity-100"
              : "max-h-0 opacity-0"
          }`}
        >
          <div
            className="px-4 pb-4 space-y-4 bg-black/80 backdrop-blur-xl border-t border-white/10 max-h-[65vh] md:max-h-[450px] overflow-y-auto"
            style={{
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.8), 0 8px 24px rgba(147,51,234,0.4)",
            }}
          >
            {/* Progress bar */}
            <div className="mt-2 transition-all duration-300">
              <ProgressBar
                currentStep={completedCount}
                totalSteps={totalSteps}
              />
            </div>

            {/* Checklist */}
            <ul className="space-y-2">
              {steps.map((step) => {
                if (!step) return null;
                return (
                  <li key={step.id} className="transition-all duration-200">
                    <div
                      className={`p-3 rounded-lg transition-all duration-300 ${
                        step.done
                          ? "bg-green-900/30 border border-green-500/50"
                          : "bg-base-200 border border-gray-700"
                      }`}
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedStepId(
                            expandedStepId === step.id ? null : step.id
                          );
                        }}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <span className="text-2xl transition-transform duration-200">
                          {step.done ? "✅" : "🎯"}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium">{step.label}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {step.done ? "✓ Completed" : "⏳ Not completed yet"}{" "}
                            • Click to{" "}
                            {expandedStepId === step.id ? "hide" : "see"}{" "}
                            details
                          </div>
                        </div>
                        <span
                          className={`text-lg transition-transform duration-300 ${
                            expandedStepId === step.id
                              ? "rotate-180"
                              : "rotate-0"
                          }`}
                        >
                          ▼
                        </span>
                      </div>

                      {/* Expanded description */}
                      <div
                        className={`transition-all duration-300 ${
                          expandedStepId === step.id
                            ? "max-h-[2000px] opacity-100 mt-3"
                            : "max-h-0 opacity-0 overflow-hidden"
                        }`}
                      >
                        <div className="pt-3 border-t border-gray-600 space-y-3">
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                            {step.description}
                          </p>

                          {/* Field-by-field checklist for Step 3 (Branding) */}
                          {step.id === 3 && step.fields && (
                            <div className="bg-base-300 rounded-lg p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                Required Fields:
                              </p>
                              {step.fields.map((field, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2"
                                >
                                  <span
                                    className={`text-sm ${
                                      field.done
                                        ? "text-green-400"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {field.done ? "✅" : "⬜"}
                                  </span>
                                  <span
                                    className={`text-sm ${
                                      field.done
                                        ? "text-white"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    {field.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Confirmation button for Steps 1 and 2 */}
                          {step.requiresConfirmation && !step.done && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (step.id === 1) {
                                  handleStep1Confirm();
                                } else if (step.id === 2) {
                                  handleStep2Confirm();
                                }
                              }}
                              className="btn btn-xs btn-success transition-all duration-200 hover:scale-105"
                            >
                              ✓ Got it!
                            </button>
                          )}

                          {/* ONLY Step 6 gets a button to preview booking page */}
                          {step.id === 6 && !step.done && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                step.action();
                              }}
                              className="btn btn-xs btn-primary transition-all duration-200 hover:scale-105"
                            >
                              🔗 Preview Booking Page
                            </button>
                          )}

                          {/* Text instructions for all other steps */}
                          {step.id === 3 && !step.done && (
                            <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                              📍 <strong>How to complete:</strong>
                              <br />
                              Scroll down → open <strong>Branding</strong> →
                              fill in <strong>ALL required fields</strong> →
                              click <strong>Save</strong>.<br />
                              <br />
                              When all fields show green checkmarks, this step
                              completes automatically.
                            </p>
                          )}
                          {step.id === 4 && !step.done && (
                            <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                              📍 <strong>How to complete:</strong>
                              <br />
                              Scroll down → open <strong>
                                Add a Service
                              </strong>{" "}
                              → enter name, price, and duration → click{" "}
                              <strong>Add Service</strong>.<br />
                              <br />
                              Adding <strong>ONE service</strong> completes this
                              step.
                            </p>
                          )}
                          {step.id === 5 && !step.done && (
                            <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                              📍 <strong>How to complete:</strong>
                              <br />
                              Scroll down → open{" "}
                              <strong>Add / Generate Slots</strong> → choose a
                              date → create <strong>at least ONE slot</strong>.
                              <br />
                              <br />
                              One slot is enough to finish this step.
                            </p>
                          )}
                          {step.id === 7 && !step.done && (
                            <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                              📍 <strong>How to complete:</strong>
                              <br />
                              Scroll down → open{" "}
                              <strong>Account & Share Link</strong> → click{" "}
                              <strong>Copy Link</strong>.<br />
                              <br />
                              That’s it. Your booking link is now live!
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Completion message when all done */}
            {allComplete && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 space-y-2">
                <p className="text-sm text-green-100 leading-relaxed">
                  <strong>🎉 You're all set!</strong> You've completed setup and
                  your SlotMe booking page is ready to accept appointments. You
                  can now share your booking link with clients and start getting
                  paid! Feel free to add further services, time slots, and
                  explore other features on our app!
                </p>
                <p className="text-sm text-green-100 leading-relaxed">
                  That’s it! You are now set to schedule bookings with SlotMe.
                  Don't forget to upgrade your to our{" "}
                  <strong className="text-purple-400">Pro</strong> and{" "}
                  <strong className="text-yellow-400">Elite</strong> tiers for
                  free!
                </p>
              </div>
            )}

            {/* Dismiss button when complete */}
            {allComplete && (
              <div className="pt-3 border-t border-white/20 transition-all duration-300">
                <button
                  onClick={handleDismiss}
                  disabled={isDismissing}
                  className="btn btn-sm btn-success w-full transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
                >
                  {isDismissing ? "Dismissing..." : "✅ Dismiss Setup Banner"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
