// src/components/Modals/TierGateModal.jsx
import { Link, useLocation } from "react-router-dom";
import BaseModal from "./BaseModal";

export default function TierGateModal({
  need = "pro",
  backHref = "/freelancer-admin",
  title = "Upgrade required",
  body,
}) {
  const location = useLocation();
  const next = location.pathname + location.search + location.hash;

  // build query first, then put #elite LAST
  const query = `?need=${encodeURIComponent(need)}&next=${encodeURIComponent(
    next
  )}`;

  return (
    <BaseModal open dismissible={false} showCloseX={false} title={title}>
      <p className="text-sm text-gray-300 text-center mt-2 whitespace-pre-line">
        {body || `This page is available on the ${need.toUpperCase()} plan.`}
      </p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Link
          to={{
            pathname: "/upgrade",
            hash: "#elite",
            search: `?need=${encodeURIComponent(
              need
            )}&next=${encodeURIComponent(next)}`,
          }}
          className="btn btn-primary w-full"
          replace
        >
          Upgrade to ELITE
        </Link>

        <Link to={backHref} className="btn btn-ghost w-full" replace>
          Back to Dashboard
        </Link>
      </div>
    </BaseModal>
  );
}
