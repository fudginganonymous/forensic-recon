/**
 * Participant home page.
 *
 * Shows:
 *  - In-progress / completed sessions (resume by clicking)
 *  - Available cases the participant can start a new session for
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import type { Case, ReconstructionSession } from "../../api/types";
import { Badge, Button, Card, ErrorMessage, PageTitle, extractErrorMessage } from "../../components/ui";

const STAGE_LABELS: Record<number, string> = {
  1: "Observation",
  2: "Hypothesis Generation",
  3: "Evidence Evaluation",
  4: "Alternative Review",
  5: "Final Reconstruction",
  6: "Completed",
};

export default function ParticipantHomePage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [sessions, setSessions] = useState<ReconstructionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingCaseId, setStartingCaseId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [casesRes, sessionsRes] = await Promise.all([
          api.get<Case[]>("/cases/participant/available"),
          api.get<ReconstructionSession[]>("/sessions/mine"),
        ]);
        setCases(casesRes.data);
        setSessions(sessionsRes.data);
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function startSession(caseId: number) {
    setStartingCaseId(caseId);
    setError(null);
    try {
      const res = await api.post<ReconstructionSession>("/sessions", { case_id: caseId });
      navigate(`/participant/sessions/${res.data.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setStartingCaseId(null);
    }
  }

  function resumeSession(sessionId: number) {
    navigate(`/participant/sessions/${sessionId}`);
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <PageTitle subtitle="Select a case to begin, or resume an in-progress session.">
        Welcome
      </PageTitle>
      <ErrorMessage message={error} />

      {sessions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-slate-800 mb-3">Your sessions</h2>
          <div className="space-y-2">
            {sessions.map((s) => {
              const caseInfo = cases.find((c) => c.id === s.case_id);
              return (
                <Card key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {caseInfo?.title || `Case #${s.case_id}`}
                    </p>
                    <p className="text-sm text-slate-500">
                      Started {new Date(s.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge color={s.current_stage === 6 ? "green" : "blue"}>
                      {STAGE_LABELS[s.current_stage]}
                    </Badge>
                    <Button variant="secondary" onClick={() => resumeSession(s.id)}>
                      {s.current_stage === 6 ? "View" : "Resume"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium text-slate-800 mb-3">Available cases</h2>
        {cases.length === 0 ? (
          <p className="text-slate-500 text-sm">No cases are currently available. Please check back later.</p>
        ) : (
          <div className="space-y-3">
            {cases.map((c) => (
              <Card key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{c.title}</p>
                  {c.description && <p className="text-sm text-slate-500 mt-1 max-w-xl">{c.description}</p>}
                </div>
                <Button onClick={() => startSession(c.id)} disabled={startingCaseId === c.id}>
                  {startingCaseId === c.id ? "Starting..." : "Start"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
