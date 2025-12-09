import BaseModal from "./BaseModal";

export default function AddonSelectionModal({
  open,
  onClose,
  addons,
  selectedAddonIds,
  onUpdateSelection,
}) {
  const handleToggle = (addonId) => {
    if (selectedAddonIds.includes(addonId)) {
      onUpdateSelection(selectedAddonIds.filter((id) => id !== addonId));
    } else {
      onUpdateSelection([...selectedAddonIds, addonId]);
    }
  };

  const selectedCount = selectedAddonIds.length;
  const selectedAddons = addons.filter((a) => selectedAddonIds.includes(a.id));
  const totalAddonPrice = selectedAddons.reduce((sum, a) => sum + a.price_usd, 0);
  const totalAddonDuration = selectedAddons.reduce(
    (sum, a) => sum + a.duration_minutes,
    0
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Select Add-Ons (Optional)"
      className="max-w-lg"
    >
      <div className="space-y-4">
        {/* Add-ons grid */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
          {addons.map((addon) => {
            const isSelected = selectedAddonIds.includes(addon.id);
            return (
              <button
                key={addon.id}
                onClick={() => handleToggle(addon.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : "border-white/20 hover:bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by button click
                    className="checkbox checkbox-sm mt-0.5 shrink-0 pointer-events-none"
                  />
                  {/* Content */}
                  <div className="flex-1">
                    <p className="font-medium text-white">{addon.name}</p>
                    {addon.description && (
                      <p className="text-sm text-gray-400 mt-1">
                        {addon.description}
                      </p>
                    )}
                    <p className="text-sm font-semibold mt-2">
  <span className="text-green-400">+${addon.price_usd.toFixed(2)}</span>
  {addon.duration_minutes > 0 && (
    <span className="text-green-400"> (+{addon.duration_minutes} mins)</span>
  )}
</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selection summary */}
        {selectedCount > 0 && (
          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
            <p className="text-sm font-medium text-center">
              {selectedCount} add-on{selectedCount !== 1 ? "s" : ""} selected
            </p>
            <p className="text-xs text-gray-400 text-center mt-1">
              +${totalAddonPrice.toFixed(2)}
              {totalAddonDuration > 0 && ` • +${totalAddonDuration} mins`}
            </p>
          </div>
        )}

        {/* Done button */}
        <button onClick={onClose} className="btn btn-primary w-full">
          Done {selectedCount > 0 && `(${selectedCount})`}
        </button>
      </div>
    </BaseModal>
  );
}