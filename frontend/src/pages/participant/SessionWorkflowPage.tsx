/**
 * SessionWorkflowPage
 *
 * The main container for a participant's reconstruction session. Loads
 * the session, case (with evidence), and all stage data, then renders
 * the appropriate stage component based on session.current_stage.
 *
 * Each "advance" action calls the corresponding backend
 * /sessions/{id}/advance-to-stage-N endpoint, then reloads session +
 * stage-4-specific data as needed.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/client";
import type {
  AlternativeReviewItem,
  CaseDetail,
  EvidenceLink,
  FinalReconstruction,
  Hypothesis,
  Observation,
  ReconstructionSession,
} from "../../api/types";
import { Card, ErrorMessage, extractErrorMessage } from "../../components/ui";
import StageProgress from "../../components/StageProgress";
import ObservationStage from "./ObservationStage";
import HypothesisStage from "./HypothesisStage";
import EvidenceStage from "./EvidenceStage";
import AlternativeReviewStage from "./AlternativeReviewStage";
import FinalReconstructionStage from "./FinalReconstructionStage";
import BayesianPanel from "./BayesianPanel";
import SessionCompleteSummary from "./SessionCompleteSummary";

export default function SessionWorkflowPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const id = Number(sessionId);

  const [session, setSession] = useState<ReconstructionSession | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>([]);
  const [alternativeItems, setAlternativeItems] = useState<AlternativeReviewItem[]>([]);
  const [finalReconstruction, setFinalReconstruction] = useState<FinalReconstruction | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const sessionRes = await api.get<ReconstructionSession>(`/sessions/${id}`);
      const s = sessionRes.data;
      setSession(s);

      const caseRes = await api.get<CaseDetail>(`/cases/participant/${s.case_id}`);
      setCaseDetail(caseRes.data as CaseDetail);

      const [obsRes, hypRes, linkRes] = await Promise.all([
        api.get<Observation[]>(`/sessions/${id}/observations`),
        api.get<Hypothesis[]>(`/sessions/${id}/hypotheses`),
        api.get<EvidenceLink[]>(`/sessions/${id}/evidence-links`),
      ]);
      setObservations(obsRes.data);
      setHypotheses(hypRes.data);
      setEvidenceLinks(linkRes.data);

      if (s.current_stage >= 4) {
        const altRes = await api.get<AlternativeReviewItem[]>(`/sessions/${id}/alternative-review`);
        setAlternativeItems(altRes.data);
      }

      if (s.current_stage >= 6) {
        const detailRes = await api.get<ReconstructionSession & { final_reconstruction: FinalReconstruction | null }>(`/sessions/${id}`);
        setFinalReconstruction(detailRes.data.final_reconstruction);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function advanceTo(stageEndpoint: string) {
    await api.post<ReconstructionSession>(`/sessions/${id}/${stageEndpoint}`);
    await loadAll();
  }

  if (loading) return <p className="text-slate-500">Loading session...</p>;
  if (error) return <ErrorMessage message={error} />;
  if (!session || !caseDetail) return <ErrorMessage message="Session not found." />;

  return (
    <div>
      <Card className="mb-6 bg-slate-50">
        <p className="text-sm text-slate-500">Case</p>
        <h1 className="text-xl font-semibold text-slate-800">{caseDetail.title}</h1>
        {caseDetail.description && <p className="text-sm text-slate-500 mt-1">{caseDetail.description}</p>}
      </Card>

      <StageProgress currentStage={session.current_stage} />

      {session.current_stage === 1 && (
        <ObservationStage
          session={session}
          observations={observations}
          onObservationAdded={(obs) => setObservations((prev) => [...prev, obs])}
          onAdvance={() => advanceTo("advance-to-stage-2")}
        />
      )}

      {session.current_stage === 2 && (
        <div className="space-y-6">
          <HypothesisStage
            session={session}
            hypotheses={hypotheses}
            onHypothesisAdded={(h) => setHypotheses((prev) => [...prev, h])}
            onHypothesisUpdated={(h) => setHypotheses((prev) => prev.map((x) => (x.id === h.id ? h : x)))}
            onAdvance={() => advanceTo("advance-to-stage-3")}
          />
        </div>
      )}

      {session.current_stage === 3 && (
        <div className="space-y-6">
          <BayesianPanel session={session} />
          <EvidenceStage
            session={session}
            hypotheses={hypotheses}
            evidenceItems={caseDetail.evidence_items}
            evidenceLinks={evidenceLinks}
            onLinkChanged={(link) =>
              setEvidenceLinks((prev) => {
                const idx = prev.findIndex((l) => l.id === link.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = link;
                  return copy;
                }
                return [...prev, link];
              })
            }
            onAdvance={() => advanceTo("advance-to-stage-4")}
          />
        </div>
      )}

      {session.current_stage === 4 && (
        <AlternativeReviewStage
          session={session}
          items={alternativeItems}
          hypotheses={hypotheses}
          evidenceItems={caseDetail.evidence_items}
          onItemAcknowledged={(item) =>
            setAlternativeItems((prev) => prev.map((x) => (x.id === item.id ? item : x)))
          }
          onAdvance={() => advanceTo("advance-to-stage-5")}
        />
      )}

      {session.current_stage === 5 && (
        <div className="space-y-6">
          <BayesianPanel session={session} />
          <FinalReconstructionStage
            session={session}
            hypotheses={hypotheses}
            onSubmitted={async () => {
              await loadAll();
            }}
          />
        </div>
      )}

      {session.current_stage === 6 && finalReconstruction && (
        <SessionCompleteSummary session={session} hypotheses={hypotheses} finalReconstruction={finalReconstruction} />
      )}
    </div>
  );
}
