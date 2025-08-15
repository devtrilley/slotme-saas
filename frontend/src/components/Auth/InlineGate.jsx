// src/components/Auth/InlineGate.jsx
import { hasTierAccess, requiredTierFor } from "../../utils/tiers";

export default function InlineGate({
  userTier = "free",
  need = "free",         // or pass a feature key using want="analyticsFull"
  want,                  // feature key; if provided we map -> min tier
  children,
  fallback = null,       // e.g., an upgrade button or disabled UI
}) {
  const min = want ? requiredTierFor(want) : need;
  if (!hasTierAccess(userTier, min)) return fallback;
  return children;
}