import BaseModal from "./BaseModal";

export default function CancelSubscriptionModal({
  open = false,
  onClose,
  onConfirm,
  tier = "pro",
}) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      dismissible={true}
      showCloseX={true}
      title="Cancel Subscription?"
      className="max-w-md"
    >
      <div className="space-y-6 text-center">
        <p className="text-white text-base">
          You'll keep access to <span className="font-bold uppercase">{tier}</span> features until the end of your billing period, then downgrade to Free.
        </p>

        <p className="text-red-400 text-sm font-semibold">
          This action cannot be undone.
        </p>

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={onConfirm}
            className="btn bg-red-600 hover:bg-red-700 text-white border-none w-full"
          >
            Yes, Cancel Subscription
          </button>

          <button
            onClick={onClose}
            className="btn btn-outline w-full"
          >
            Keep Subscription
          </button>
        </div>
      </div>
    </BaseModal>
  );
}