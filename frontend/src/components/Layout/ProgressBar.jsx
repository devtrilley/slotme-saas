export default function ProgressBar({ currentStep, totalSteps }) {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full space-y-2">
      {/* Step label */}
      <div className="text-center text-sm font-medium text-gray-300">
        Step {currentStep} of {totalSteps}
      </div>

      {/* Progress bar container */}
      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        {/* Filled portion */}
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Percentage label */}
      <div className="text-center text-xs text-gray-400">
        {Math.round(percentage)}% Complete
      </div>
    </div>
  );
}
