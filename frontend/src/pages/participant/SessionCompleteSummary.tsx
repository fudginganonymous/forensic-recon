/**
 * SessionCompleteSummary
 *
 * Shown once a session reaches stage 6 (completed). Displays a
 * thank-you message and a summary of the participant's final
 * submission. Detailed metrics are reserved for the researcher
 * dashboard - participants only see a confirmation here.
 */
import { useNavigate } from "react-router-dom";
import type { FinalReconstruction, Hypothesis, ReconstructionSession } from "../../api/types";
import { Button, Card, PageTitle } from "../../components/ui";

interface Props {
  session: ReconstructionSession;
  hypotheses: Hypothesis[];
  finalReconstruction: FinalReconstruction;
}

export default function SessionCompleteSummary({ hypotheses, finalReconstruction }: Props) {
  const navigate = useNavigate();
  const selected = hypotheses.find((h) => h.id === finalReconstruction.selected_hypothesis_id);

  return (
    <div className="space-y-6">
      <PageTitle subtitle="Thank you for completing this reconstruction exercise.">
        Session complete
      </PageTitle>
      <Card>
        <h3 className="font-medium text-slate-800 mb-2">Your final reconstruction</h3>
        <p className="text-sm text-slate-500 mb-1">
          <span className="font-medium text-slate-700">Selected hypothesis:</span> {selected?.title}
        </p>
        <p className="text-sm text-slate-500 mb-3">
          <span className="font-medium text-slate-700">Final confidence:</span> {finalReconstruction.final_confidence}%
        </p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{finalReconstruction.final_narrative}</p>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => navigate("/participant")}>Return to home</Button>
      </div>
    </div>
  );
}
