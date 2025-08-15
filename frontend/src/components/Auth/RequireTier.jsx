// src/components/Auth/RequireTier.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "../../utils/axiosInstance";
import { hasTierAccess, requiredTierFor } from "../../utils/tiers";
import TierGateModal from "../Modals/TierGateModal";

export default function RequireTier({
  min = "free",
  feature, // e.g., "analyticsFull"
  children,
  backHref = "/freelancer-admin",
}) {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState("free");

  const needed = useMemo(
    () => (feature ? requiredTierFor(feature) : min) || "free",
    [feature, min]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await axios.get("/freelancer-info");
        if (!mounted) return;
        setTier((data?.tier || "free").toLowerCase());
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;

  if (!hasTierAccess(tier, needed)) {
    return <TierGateModal need={needed} backHref={backHref} />;
  }

  return children;
}
