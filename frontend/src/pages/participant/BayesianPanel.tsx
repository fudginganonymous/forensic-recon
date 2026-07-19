/**
 * BayesianPanel - optional decision-support aid.
 *
 * Only rendered when session.bayesian_enabled_snapshot is true. Lets
 * the participant compute/refresh a posterior probability for each
 * hypothesis (based on likelihood ratios entered in Stage 3) and view
 * the resulting probability trail as a simple bar/line representation.
 *
 * This panel is entirely optional - the workflow functions fully
 * without it, and nothing here is required to advance stages.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import type { BayesianHypothesisSummary, ReconstructionSession } from "../../api/types";
import { Button, Card, ErrorMessage, extractErrorMessage } from "../../components/ui";

interface Props {
  session: ReconstructionSession;
}

export default function BayesianPanel({ session }: Props) {
  const [summaries, setSummaries] = useState<BayesianHypothesisSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [computingId, setComputingId] = useState<number | null>(null);

  async function load() {
    try {
      const res = await api.get<BayesianHypothesisSummary[]>(`/bayesian/sessions/${session.id}/summary`);
      setSummaries(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  async function computeUpdate(hypothesisId: number) {
    setComputingId(hypothesisId);
    setError(null);
    try {
      await api.post(`/bayesian/hypotheses/${hypothesisId}/update`, {});
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setComputingId(null);
    }
  }

  if (!session.bayesian_enabled_snapshot) return null;
  if (loading) return null;

  return (
    <Card className="bg-indigo-50 border-indigo-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-indigo-900">Optional: Bayesian decision-support</h3>
        <span className="text-xs text-indigo-500">Not required to proceed</span>
      </div>
      <p className="text-sm text-indigo-700 mb-2">
        The researcher has enabled optional Bayesian decision support for this case.
        This tool computes a posterior probability for each hypothesis based on likelihood
        ratios you can assign when evaluating evidence in Stage 4.
      </p>
      <p className="text-sm text-indigo-700 mb-3">
        <strong>How to use it:</strong> In Stage 4 (Evidence Evaluation), enter a likelihood
        ratio alongside each stance you assign. A ratio above 1 means the evidence favours
        that hypothesis; below 1 means it counts against it; 1 means no effect. Then return
        here and click "Compute posterior" to see the updated probability. Using this tool
        is entirely optional — you can complete the reconstruction without it.
      </p>
      <ErrorMessage message={error} />
      <div className="space-y-3">
        {summaries.map((s) => (
          <div key={s.hypothesis_id} className="bg-white rounded-md p-3 border border-indigo-100">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">{s.hypothesis_title}</p>
              <Button variant="secondary" onClick={() => computeUpdate(s.hypothesis_id)} disabled={computingId === s.hypothesis_id}>
                {computingId === s.hypothesis_id ? "Computing..." : "Compute posterior"}
              </Button>
            </div>
            {s.latest_posterior !== null && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Prior: {((s.prior ?? 0.5) * 100).toFixed(1)}%</span>
                  <span>Posterior: {(s.latest_posterior * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${s.latest_posterior * 100}%` }}
                  />
                </div>
                {s.trail.length > 1 && (
                  <p className="text-xs text-slate-400 mt-1">
                    {s.trail.length} updates recorded in reasoning trail
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
