import { useState, type FormEvent } from "react";
import api from "../../api/client";
import type { Observation, ReconstructionSession } from "../../api/types";
import { Button, Card, ErrorMessage, Input, Label, Textarea, extractErrorMessage } from "../../components/ui";

interface Props {
  session: ReconstructionSession;
  observations: Observation[];
  onObservationAdded: (obs: Observation) => void;
  onObservationUpdated: (obs: Observation) => void;
  onObservationDeleted: (obsId: number) => void;
  onAdvance: () => Promise<void>;
  isEditMode?: boolean;
}

export default function ObservationStage({ session, observations, onObservationAdded, onObservationUpdated, onObservationDeleted, onAdvance, isEditMode }: Props) {
  const [observationText, setObservationText] = useState("");
  const [source, setSource] = useState("");
  const [observedTimestamp, setObservedTimestamp] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editSource, setEditSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<Observation>(`/sessions/${session.id}/observations`, {
        observation_text: observationText,
        source,
        observed_timestamp: observedTimestamp ? new Date(observedTimestamp).toISOString() : null,
      });
      onObservationAdded(res.data);
      setObservationText("");
      setSource("");
      setObservedTimestamp("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(obs: Observation) {
    setError(null);
    try {
      const res = await api.patch<Observation>(`/sessions/${session.id}/observations/${obs.id}`, {
        observation_text: editText,
        source: editSource,
        observed_timestamp: obs.observed_timestamp,
      });
      onObservationUpdated(res.data);
      setEditingId(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleDelete(obsId: number) {
    setError(null);
    try {
      await api.delete(`/sessions/${session.id}/observations/${obsId}`);
      onObservationDeleted(obsId);
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
        <h2 className="text-lg font-medium text-slate-800 mb-2">Stage 1: Observation</h2>
        <p className="text-sm text-slate-500 mb-4">
          Record only what you directly observe. Do not interpret or draw conclusions yet.
          {isEditMode && <span className="ml-1 text-amber-600 font-medium">You are editing a previous stage — changes are saved automatically.</span>}
        </p>
        <ErrorMessage message={error} />
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <Label>Observation</Label>
            <Textarea value={observationText} onChange={(e) => setObservationText(e.target.value)} required rows={3} placeholder="e.g. A dark red stain approximately 30cm in diameter on the kitchen floor tiles." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} required placeholder="e.g. Direct visual inspection, photograph #3" />
            </div>
            <div>
              <Label>Observed timestamp (optional)</Label>
              <Input type="datetime-local" value={observedTimestamp} onChange={(e) => setObservedTimestamp(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={submitting}>{submitting ? "Adding..." : "Add observation"}</Button>
        </form>
      </Card>

      {observations.length > 0 && (
        <Card>
          <h3 className="font-medium text-slate-800 mb-3">Recorded observations ({observations.length})</h3>
          <ul className="space-y-3">
            {observations.map((obs) => (
              <li key={obs.id} className="border border-slate-100 rounded-md p-3">
                {editingId === obs.id ? (
                  <div className="space-y-2">
                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} />
                    <Input value={editSource} onChange={(e) => setEditSource(e.target.value)} />
                    <div className="flex gap-2">
                      <Button onClick={() => handleEdit(obs)}>Save</Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-800">{obs.observation_text}</p>
                      <p className="text-xs text-slate-400 mt-1">Source: {obs.source}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" className="text-xs" onClick={() => { setEditingId(obs.id); setEditText(obs.observation_text); setEditSource(obs.source); }}>Edit</Button>
                      <Button variant="ghost" className="text-xs text-red-500" onClick={() => handleDelete(obs.id)}>Delete</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!isEditMode && (
        <div className="flex justify-end">
          <Button onClick={handleAdvance} disabled={observations.length === 0 || advancing}>
            {advancing ? "Proceeding..." : "Continue to Evidence Review"}
          </Button>
        </div>
      )}
    </div>
  );
}
