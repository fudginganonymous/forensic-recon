/**
 * Stage 4: Alternative Hypothesis Review
 *
 * The system has automatically generated a list of items the
 * participant must acknowledge:
 *   - alternative_hypothesis: hypotheses other than the currently
 *     favoured one
 *   - contradictory_evidence: evidence that contradicts/weakly
 *     contradicts the favoured hypothesis
 *   - unassigned_evidence: evidence never linked to the favoured
 *     hypothesis
 *
 * All items must be acknowledged (with an optional reflection note)
 * before advancing to Stage 5.
 */
import { useState } from "react";
import api from "../../api/client";
import type { AlternativeReviewItem, EvidenceItem, Hypothesis, ReconstructionSession } from "../../api/types";
import { Button, Card, ErrorMessage, Textarea, extractErrorMessage } from "../../components/ui";

interface Props {
  session: ReconstructionSession;
  items: AlternativeReviewItem[];
  hypotheses: Hypothesis[];
  evidenceItems: EvidenceItem[];
  onItemAcknowledged: (item: AlternativeReviewItem) => void;
  onAdvance: () => Promise<void>;
  isEditMode?: boolean;
}

const TYPE_LABELS: Record<string, { title: string; description: string }> = {
  alternative_hypothesis: {
    title: "Alternative hypothesis not currently favoured",
    description: "Consider why this explanation might still be plausible, and what would need to be true for it to hold.",
  },
  contradictory_evidence: {
    title: "Evidence that contradicts your favoured hypothesis",
    description: "Reflect on how this evidence fits (or doesn't fit) with the explanation you currently favour.",
  },
  unassigned_evidence: {
    title: "Evidence not yet linked to your favoured hypothesis",
    description: "Consider whether this evidence has any bearing on your favoured hypothesis that you may have overlooked.",
  },
};

export default function AlternativeReviewStage({ session, items, hypotheses, evidenceItems, onItemAcknowledged, onAdvance }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  function getReferenceLabel(item: AlternativeReviewItem): string {
    if (item.item_type === "alternative_hypothesis" && item.hypothesis_id) {
      const h = hypotheses.find((h) => h.id === item.hypothesis_id);
      return h ? h.title : `Hypothesis #${item.hypothesis_id}`;
    }
    if (item.evidence_item_id) {
      const e = evidenceItems.find((e) => e.id === item.evidence_item_id);
      return e ? e.label : `Evidence #${item.evidence_item_id}`;
    }
    return "";
  }

  async function handleAcknowledge(item: AlternativeReviewItem) {
    setSavingId(item.id);
    setError(null);
    try {
      const res = await api.post<AlternativeReviewItem>(
        `/sessions/${session.id}/alternative-review/${item.id}/acknowledge`,
        { reflection_note: notes[item.id] || null }
      );
      onItemAcknowledged(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSavingId(null);
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

  const allAcknowledged = items.length > 0 && items.every((i) => i.acknowledged);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-medium text-slate-800 mb-2">Stage 4: Alternative Hypothesis Review</h2>
        <p className="text-sm text-slate-500">
          Before reaching a conclusion, review the following points. For each, take a moment
          to genuinely consider it, then mark it as acknowledged. You may optionally record a
          brief reflection.
        </p>
      </Card>

      <ErrorMessage message={error} />

      {items.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">No alternative review items were generated for this session.</p>
        </Card>
      )}

      {items.map((item) => {
        const meta = TYPE_LABELS[item.item_type];
        return (
          <Card key={item.id} className={item.acknowledged ? "border-green-200" : ""}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{meta.title}</p>
                <p className="font-medium text-slate-800 mt-1">{getReferenceLabel(item)}</p>
                <p className="text-sm text-slate-500 mt-1">{meta.description}</p>
              </div>
              {item.acknowledged && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">Acknowledged</span>}
            </div>
            {!item.acknowledged && (
              <div className="mt-2 space-y-2">
                <Textarea
                  placeholder="Optional reflection..."
                  rows={2}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
                <Button variant="secondary" onClick={() => handleAcknowledge(item)} disabled={savingId === item.id}>
                  {savingId === item.id ? "Saving..." : "Acknowledge"}
                </Button>
              </div>
            )}
            {item.acknowledged && item.reflection_note && (
              <p className="text-sm text-slate-600 mt-2 italic">"{item.reflection_note}"</p>
            )}
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={handleAdvance} disabled={!allAcknowledged || advancing}>
          {advancing ? "Proceeding..." : "Continue to Final Reconstruction"}
        </Button>
      </div>
      {!allAcknowledged && (
        <p className="text-sm text-slate-400 text-right">All items above must be acknowledged to continue.</p>
      )}
    </div>
  );
}
