/**
 * Stage 5: Final Reconstruction
 *
 * Collects the participant's selected hypothesis, final narrative, and
 * final confidence rating. Submission completes the session and
 * triggers final metrics computation server-side.
 */
import { useState, type FormEvent } from "react";
import api from "../../api/client";
import type { FinalReconstruction, Hypothesis, ReconstructionSession } from "../../api/types";
import { Button, Card, ErrorMessage, Label, Textarea, extractErrorMessage } from "../../components/ui";

interface Props {
  session: ReconstructionSession;
  hypotheses: Hypothesis[];
  onSubmitted: (final: FinalReconstruction) => void;
}

export default function FinalReconstructionStage({ session, hypotheses, onSubmitted }: Props) {
  const activeHypotheses = hypotheses.filter((h) => !h.abandoned_at);
  const [selectedId, setSelectedId] = useState<number | null>(activeHypotheses[0]?.id ?? null);
  const [narrative, setNarrative] = useState("");
  const [confidence, setConfidence] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedId === null) {
      setError("Please select a hypothesis.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<FinalReconstruction>(`/sessions/${session.id}/final-reconstruction`, {
        selected_hypothesis_id: selectedId,
        final_narrative: narrative,
        final_confidence: confidence,
      });
      onSubmitted(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-medium text-slate-800 mb-2">Stage 5: Final Reconstruction</h2>
        <p className="text-sm text-slate-500 mb-4">
          Select the hypothesis that best explains the evidence, write a final narrative
          summarising your reconstruction of events, and indicate your overall confidence in
          this conclusion. This is the final step — once submitted, the session will be
          complete.
        </p>
        <ErrorMessage message={error} />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Selected hypothesis</Label>
            <div className="space-y-2">
              {activeHypotheses.map((h) => (
                <label key={h.id} className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer ${selectedId === h.id ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
                  <input
                    type="radio"
                    name="selected_hypothesis"
                    checked={selectedId === h.id}
                    onChange={() => setSelectedId(h.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{h.title}</p>
                    <p className="text-xs text-slate-500">{h.description}</p>
                    <p className="text-xs text-slate-400 mt-1">Current confidence: {h.current_confidence}%</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Final narrative</Label>
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              required
              rows={6}
              placeholder="Describe your final reconstruction of events, referencing the supporting evidence."
            />
          </div>
          <div>
            <Label>Final confidence: {confidence}%</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit final reconstruction"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
