import React from "react";

export default function PasswordChecklist({ password, confirmPassword }) {
  const baseRules = [
    { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
    { label: "At least one uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
    { label: "At least one lowercase letter", test: (pw) => /[a-z]/.test(pw) },
    { label: "At least one number", test: (pw) => /[0-9]/.test(pw) },
    {
      label: "At least one special character",
      test: (pw) => /[^A-Za-z0-9]/.test(pw),
    },
  ];

  // ✅ Add “passwords match” rule if confirmPassword is provided
  const rules = confirmPassword
    ? [
        ...baseRules,
        {
          label: "Passwords match",
          test: () =>
            password && confirmPassword && password === confirmPassword,
        },
      ]
    : baseRules;

  return (
    <div className="text-xs mt-1 space-y-0.5">
      {rules.map((rule, idx) => {
        const passed = rule.test(password || "");
        return (
          <p
            key={idx}
            className={`transition-colors ${
              passed ? "text-green-400" : "text-red-400"
            }`}
          >
            {passed ? "✓" : "✗"} {rule.label}
          </p>
        );
      })}
    </div>
  );
}
