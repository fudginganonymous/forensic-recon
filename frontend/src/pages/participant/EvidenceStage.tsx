/**
 * Stage 3: Evidence Evaluation
 *
 * For each evidence item, the participant indicates how it relates to
 * each hypothesis using the 5-point stance scale. Every evidence item
 * must have at least one link before advancing (enforced both here via
 * the review-status check and server-side).
 *
 * If the Bayesian module is enabled for this case, an optional
 * likelihood ratio input is also shown per link.
 */
import { useState } from "react";
import api from "../../api/client";
import type { EvidenceItem, EvidenceLink, Hypothesis, ReconstructionSession, Stance } from "../../api/types";
import { Button, Card, ErrorMessage, extractErrorMessage } from "../../components/ui";

interface Props {
  session: ReconstructionSession;
  hypotheses: Hypothesis[];
  evidenceItems: EvidenceItem[];
  evidenceLinks: EvidenceLink[];
  onLinkChanged: (link: EvidenceLink) => void;
  onAdvance: () => Promise<void>;
}

const STANCE_OPTIONS: { value: Stance; label: string; color: string }[] = [
  { value: "contradicts", label: "Contradicts", color: "bg-red-100 border-red-400 text-red-700" },
  { value: "weakly_contradicts", label: "Weakly contradicts", color: "bg-orange-50 border-orange-300 text-orange-600" },
  { value: "neutral", label: "Neutral", color: "bg-slate-100 border-slate-300 text-slate-600" },
  { value: "weakly_supports", label: "Weakly supports", color: "bg-lime-50 border-lime-300 text-lime-700" },
  { value: "supports", label: "Supports", color: "bg-green-100 border-green-400 text-green-700" },
];

export default function EvidenceStage({ session, hypotheses, evidenceItems, evidenceLinks, onLinkChanged, onAdvance }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [likelihoodRatios, setLikelihoodRatios] = useState<Record<string, string>>({});

  const activeHypotheses = hypotheses.filter((h) => !h.abandoned_at);

  function findLink(evidenceItemId: number, hypothesisId: number): EvidenceLink | undefined {
    return evidenceLinks.find((l) => l.evidence_item_id === evidenceItemId && l.hypothesis_id === hypothesisId);
  }

  async function setStance(evidenceItemId: number, hypothesisId: number, stance: Stance) {
    const key = `${evidenceItemId}-${hypothesisId}`;
    setSavingKey(key);
    setError(null);
    try {
      const existing = findLink(evidenceItemId, hypothesisId);
      const lrStr = likelihoodRatios[key];
      const likelihood_ratio = lrStr ? parseFloat(lrStr) : existing?.likelihood_ratio ?? null;

      const res = await api.post<EvidenceLink>(`/sessions/${session.id}/evidence-links`, {
        evidence_item_id: evidenceItemId,
        hypothesis_id: hypothesisId,
        stance,
        likelihood_ratio,
      });
      onLinkChanged(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSavingKey(null);
    }
  }

  async function handleAdvance() {
    setError(null);
    setAdvancing(true);
    try {
      await onAdvance();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setAdvancing(false);
    }
  }

  const reviewedItemIds = new Set(evidenceLinks.map((l) => l.evidence_item_id));
  const allReviewed = evidenceItems.every((item) => reviewedItemIds.has(item.id));

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-medium text-slate-800 mb-2">Stage 3: Evidence Evaluation</h2>
        <p className="text-sm text-slate-500 mb-4">
          For each piece of evidence, indicate how strongly it supports or contradicts each
          of your hypotheses. Every evidence item must be evaluated against at least one
          hypothesis before you can continue.
          {session.bayesian_enabled_snapshot && (
            <> You may optionally enter a likelihood ratio (a number greater than 0; 1 = no effect, &gt;1 favours the hypothesis, &lt;1 counts against it) for use by the Bayesian module.</>
          )}
        </p>
        <ErrorMessage message={error} />
      </Card>

      {evidenceItems.map((item) => {
        const isReviewed = reviewedItemIds.has(item.id);
        return (
          <Card key={item.id}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-slate-800">{item.label}</p>
                <p className="text-sm text-slate-500 mt-1">{item.description}</p>
              </div>
              {!isReviewed && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Not yet reviewed</span>
              )}
            </div>
            <div className="space-y-3">
              {activeHypotheses.map((h) => {
                const link = findLink(item.id, h.id);
                const key = `${item.id}-${h.id}`;
                return (
                  <div key={h.id} className="border border-slate-100 rounded-md p-3">
                    <p className="text-sm font-medium text-slate-700 mb-2">{h.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {STANCE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={savingKey === key}
                          onClick={() => setStance(item.id, h.id, opt.value)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition
                            ${link?.stance === opt.value ? opt.color + " ring-2 ring-offset-1 ring-blue-400" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {session.bayesian_enabled_snapshot && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-slate-400">Likelihood ratio (optional):</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.01"
                          placeholder="e.g. 2.0"
                          defaultValue={link?.likelihood_ratio ?? ""}
                          onChange={(e) => setLikelihoodRatios((prev) => ({ ...prev, [key]: e.target.value }))}
                          onBlur={() => {
                            if (link) setStance(item.id, h.id, link.stance);
                          }}
                          className="w-24 border border-slate-200 rounded px-2 py-1 text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={handleAdvance} disabled={!allReviewed || advancing}>
          {advancing ? "Proceeding..." : "Continue to Alternative Review"}
        </Button>
      </div>
      {!allReviewed && (
        <p className="text-sm text-slate-400 text-right">
          All evidence items must be evaluated against at least one hypothesis to continue.
        </p>
      )}
    </div>
  );
}
