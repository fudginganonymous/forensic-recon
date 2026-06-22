/**
 * Stage 1: Observation
 *
 * Participants record pure observations (no interpretation): text,
 * source, and an optional observed timestamp. At least one observation
 * is required before advancing.
 */
import { useState, type FormEvent } from "react";
import api from "../../api/client";
import type { Observation, ReconstructionSession } from "../../api/types";
import { Button, Card, ErrorMessage, Input, Label, Textarea, extractErrorMessage } from "../../components/ui";

interface Props {
  session: ReconstructionSession;
  observations: Observation[];
  onObservationAdded: (obs: Observation) => void;
  onAdvance: () => Promise<void>;
}

export default function ObservationStage({ session, observations, onObservationAdded, onAdvance }: Props) {
  const [observationText, setObservationText] = useState("");
  const [source, setSource] = useState("");
  const [observedTimestamp, setObservedTimestamp] = useState("");
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
          Record only what you directly observe at the scene. Do not interpret, explain, or
          draw conclusions yet — simply document what you see and where it came from.
        </p>
        <ErrorMessage message={error} />
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <Label>Observation</Label>
            <Textarea
              value={observationText}
              onChange={(e) => setObservationText(e.target.value)}
              required
              rows={3}
              placeholder="e.g. A dark red stain approximately 30cm in diameter on the kitchen floor tiles."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
                placeholder="e.g. Direct visual inspection, photograph #3, witness statement"
              />
            </div>
            <div>
              <Label>Observed timestamp (optional)</Label>
              <Input
                type="datetime-local"
                value={observedTimestamp}
                onChange={(e) => setObservedTimestamp(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add observation"}
          </Button>
        </form>
      </Card>

      {observations.length > 0 && (
        <Card>
          <h3 className="font-medium text-slate-800 mb-3">Recorded observations ({observations.length})</h3>
          <ul className="space-y-3">
            {observations.map((obs) => (
              <li key={obs.id} className="border-b border-slate-100 pb-2 last:border-none last:pb-0">
                <p className="text-sm text-slate-800">{obs.observation_text}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Source: {obs.source}
                  {obs.observed_timestamp && ` · Observed: ${new Date(obs.observed_timestamp).toLocaleString()}`}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleAdvance} disabled={observations.length === 0 || advancing}>
          {advancing ? "Proceeding..." : "Continue to Hypothesis Generation"}
        </Button>
      </div>
      {observations.length === 0 && (
        <p className="text-sm text-slate-400 text-right">Add at least one observation to continue.</p>
      )}
    </div>
  );
}
