import { useState, type FormEvent } from "react";
import api from "../../api/client";
import type { Hypothesis, ReconstructionSession } from "../../api/types";
import { Button, Card, ErrorMessage, Input, Label, Textarea, extractErrorMessage } from "../../components/ui";

interface Props {
  session: ReconstructionSession;
  hypotheses: Hypothesis[];
  onHypothesisAdded: (h: Hypothesis) => void;
  onHypothesisUpdated: (h: Hypothesis) => void;
  onHypothesisDeleted: (hId: number) => void;
  onAdvance: () => Promise<void>;
  isEditMode?: boolean;
}

export default function HypothesisStage({ session, hypotheses, onHypothesisAdded, onHypothesisUpdated, onHypothesisDeleted, onAdvance, isEditMode }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [confidence, setConfidence] = useState(50);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const activeHypotheses = hypotheses.filter((h) => !h.abandoned_at);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<Hypothesis>(`/sessions/${session.id}/hypotheses`, {
        title,
        description,
        initial_confidence: confidence,
      });
      onHypothesisAdded(res.data);
      setTitle("");
      setDescription("");
      setConfidence(50);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfidenceChange(hypothesis: Hypothesis, newConfidence: number) {
    try {
      const res = await api.patch<Hypothesis>(`/sessions/${session.id}/hypotheses/${hypothesis.id}`, { current_confidence: newConfidence });
      onHypothesisUpdated(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleEditDescription(hypothesis: Hypothesis) {
    try {
      const res = await api.patch<Hypothesis>(`/sessions/${session.id}/hypotheses/${hypothesis.id}`, { description: editDescription });
      onHypothesisUpdated(res.data);
      setEditingId(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleAbandonToggle(hypothesis: Hypothesis) {
    try {
      const res = await api.post<Hypothesis>(`/sessions/${session.id}/hypotheses/${hypothesis.id}/abandon`, { abandon: !hypothesis.abandoned_at });
      onHypothesisUpdated(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleDelete(hypothesisId: number) {
    try {
      await api.delete(`/sessions/${session.id}/hypotheses/${hypothesisId}`);
      onHypothesisDeleted(hypothesisId);
    } catch (err) {
      setError(extractErrorMessage(err));
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

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-medium text-slate-800 mb-2">Stage 3: Hypothesis Generation</h2>
        <p className="text-sm text-slate-500 mb-4">
          Propose at least two competing explanations. Use the evidence sidebar on the left to refer back to the evidence at any time.
          {isEditMode && <span className="ml-1 text-amber-600 font-medium">Editing mode — your changes are saved immediately.</span>}
        </p>
        <ErrorMessage message={error} />
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <Label>Hypothesis title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. The injury was self-inflicted" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
          </div>
          <div>
            <Label>Initial confidence: {confidence}%</Label>
            <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full" />
          </div>
          <Button type="submit" disabled={submitting}>{submitting ? "Adding..." : "Add hypothesis"}</Button>
        </form>
      </Card>

      {hypotheses.map((h) => (
        <Card key={h.id} className={h.abandoned_at ? "opacity-50" : ""}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-medium text-slate-800">
                {h.title}
                {h.abandoned_at && <span className="text-xs text-red-500 ml-2">(Abandoned)</span>}
              </p>
              {editingId === h.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button onClick={() => handleEditDescription(h)}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 mt-1">{h.description}</p>
              )}
            </div>
            <div className="flex gap-1 ml-2 shrink-0">
              <Button variant="ghost" className="text-xs" onClick={() => { setEditingId(h.id); setEditDescription(h.description); }}>Edit</Button>
              <Button variant="ghost" className="text-xs text-red-500" onClick={() => handleDelete(h.id)}>Delete</Button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex-1">
              <Label>Confidence: {h.current_confidence}%</Label>
              <input
                type="range" min={0} max={100} value={h.current_confidence}
                disabled={!!h.abandoned_at}
                onMouseUp={(e) => handleConfidenceChange(h, Number((e.target as HTMLInputElement).value))}
                onChange={(e) => onHypothesisUpdated({ ...h, current_confidence: Number(e.target.value) })}
                className="w-full"
              />
              {h.initial_confidence !== h.current_confidence && (
                <p className="text-xs text-slate-400 mt-1">Revised from initial {h.initial_confidence}%</p>
              )}
            </div>
            <Button variant={h.abandoned_at ? "secondary" : "ghost"} onClick={() => handleAbandonToggle(h)} className="text-xs">
              {h.abandoned_at ? "Reinstate" : "Abandon"}
            </Button>
          </div>
        </Card>
      ))}

      {!isEditMode && (
        <div className="flex justify-end">
          <Button onClick={handleAdvance} disabled={activeHypotheses.length < 2 || advancing}>
            {advancing ? "Proceeding..." : "Continue to Evidence Evaluation"}
          </Button>
        </div>
      )}
      {!isEditMode && activeHypotheses.length < 2 && (
        <p className="text-sm text-slate-400 text-right">At least two active hypotheses required.</p>
      )}
    </div>
  );
}