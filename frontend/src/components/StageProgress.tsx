const STAGES = [
  { num: 1, label: "Observation" },
  { num: 2, label: "Evidence Review" },
  { num: 3, label: "Hypotheses" },
  { num: 4, label: "Evidence" },
  { num: 5, label: "Review" },
  { num: 6, label: "Final" },
];

export default function StageProgress({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex items-center mb-8 overflow-x-auto pb-2">
      {STAGES.map((stage, idx) => {
        const isComplete = currentStage > stage.num || currentStage === 7;
        const isCurrent = currentStage === stage.num;
        return (
          <div key={stage.num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center min-w-[56px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${isComplete ? "bg-green-500 text-white" : isCurrent ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}
              >
                {isComplete ? "✓" : stage.num}
              </div>
              <span className={`text-xs mt-1 text-center ${isCurrent ? "text-blue-700 font-medium" : "text-slate-500"}`}>
                {stage.label}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${isComplete ? "bg-green-500" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}