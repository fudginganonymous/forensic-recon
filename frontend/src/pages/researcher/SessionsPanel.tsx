/**
 * SessionsPanel
 *
 * Lists all reconstruction sessions across participants. Clicking a
 * session shows its computed metrics, raw activity log, and (if a
 * final reconstruction exists) allows the researcher to enter an
 * accuracy score, which feeds the confidence calibration metric.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import type { ReconstructionSession, SessionMetrics } from "../../api/types";
import { Badge, Button, Card, ErrorMessage, Input, Label, extractErrorMessage } from "../../components/ui";

const STAGE_LABELS: Record<number, string> = {
  1: "Observation",
  2: "Hypothesis Generation",
  3: "Evidence Evaluation",
  4: "Alternative Review",
  5: "Final Reconstruction",
  6: "Completed",
};

export default function SessionsPanel() {
  const [sessions, setSessions] = useState<ReconstructionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load() {
    try {
      const res = await api.get<ReconstructionSession[]>("/researcher/sessions");
      setSessions(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-3">
      <ErrorMessage message={error} />
      {sessions.length === 0 && <p className="text-slate-500 text-sm">No sessions yet.</p>}
      {sessions.map((s) => (
        <Card key={s.id}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">
                Session #{s.id} — Participant #{s.participant_id} — Case #{s.case_id}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Started {new Date(s.started_at).toLocaleString()}
                {s.completed_at && ` · Completed ${new Date(s.completed_at).toLocaleString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={s.current_stage === 6 ? "green" : "blue"}>{STAGE_LABELS[s.current_stage]}</Badge>
              <Button variant="ghost" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                {expandedId === s.id ? "Hide details" : "View details"}
              </Button>
            </div>
          </div>
          {expandedId === s.id && <SessionDetail session={s} />}
        </Card>
      ))}
    </div>
  );
}

function SessionDetail({ session }: { session: ReconstructionSession }) {
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accuracyInput, setAccuracyInput] = useState("");
  const [savingAccuracy, setSavingAccuracy] = useState(false);

  async function load(recompute = false) {
    try {
      const res = await api.get<SessionMetrics>(`/researcher/sessions/${session.id}/metrics${recompute ? "?recompute=true" : ""}`);
      setMetrics(res.data);
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

  async function submitAccuracy() {
    setSavingAccuracy(true);
    setError(null);
    try {
      await api.patch(`/sessions/${session.id}/final-reconstruction/accuracy`, {
        accuracy_score: Number(accuracyInput),
      });
      await load(true);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSavingAccuracy(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400 mt-3">Loading metrics...</p>;

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
      <ErrorMessage message={error} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricGroup title="Hypothesis Flexibility" score={metrics?.hypothesis_flexibility_score}>
          <MetricRow label="Hypotheses generated" value={metrics?.num_hypotheses_generated} />
          <MetricRow label="Hypothesis revisions" value={metrics?.num_hypothesis_revisions} />
          <MetricRow label="Evidence-hypothesis links" value={metrics?.num_evidence_hypothesis_links} />
          <MetricRow label="Alternatives retained at final" value={metrics?.num_alternatives_retained_at_final} />
          <MetricRow label="Contradictory acknowledgements" value={metrics?.num_contradictory_acknowledgements} />
        </MetricGroup>

        <MetricGroup title="Premature Closure" score={metrics?.premature_closure_score} higherIsWorse>
          <MetricRow
            label="Time to first preferred (s)"
            value={metrics?.time_to_first_preferred_hypothesis_seconds?.toFixed(1)}
          />
          <MetricRow label="Hypotheses abandoned early" value={metrics?.num_hypotheses_abandoned_early} />
          <MetricRow label="Contradictory evidence ignored" value={metrics?.num_contradictory_evidence_ignored} />
          <MetricRow label="Evidence items reviewed" value={metrics?.num_evidence_reviewed_before_final} />
        </MetricGroup>

        <MetricGroup title="Confidence Calibration">
          <MetricRow label="Initial confidence (selected)" value={metrics?.initial_confidence_of_selected} suffix="%" />
          <MetricRow label="Final confidence" value={metrics?.final_confidence} suffix="%" />
          <MetricRow label="Final accuracy (researcher-scored)" value={metrics?.final_accuracy} suffix="%" />
          <MetricRow label="Calibration error" value={metrics?.calibration_error} />
        </MetricGroup>
      </div>

      {session.current_stage === 6 && metrics?.final_accuracy === null && (
        <div className="flex items-end gap-2 bg-amber-50 border border-amber-100 rounded-md p-3">
          <div className="flex-1">
            <Label>Score reconstruction accuracy (0-100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={accuracyInput}
              onChange={(e) => setAccuracyInput(e.target.value)}
              placeholder="Compare final narrative to case ground truth"
            />
          </div>
          <Button onClick={submitAccuracy} disabled={!accuracyInput || savingAccuracy}>
            {savingAccuracy ? "Saving..." : "Submit score"}
          </Button>
        </div>
      )}

      <Button variant="secondary" onClick={() => load(true)}>
        Recompute metrics
      </Button>
    </div>
  );
}

function MetricGroup({ title, score, higherIsWorse, children }: { title: string; score?: number | null; higherIsWorse?: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-slate-700">{title}</h4>
        {score !== undefined && score !== null && (
          <Badge color={higherIsWorse ? (score > 50 ? "red" : "green") : score > 50 ? "green" : "amber"}>
            {score.toFixed(1)}
          </Badge>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, suffix = "" }: { label: string; value?: number | string | null; suffix?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium">{value === null || value === undefined ? "—" : `${value}${suffix}`}</span>
    </div>
  );
}
