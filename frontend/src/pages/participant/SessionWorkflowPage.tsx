/**
 * SessionWorkflowPage
 *
 * Main container for the 6-stage reconstruction workflow.
 * Includes collapsible evidence sidebar throughout all stages,
 * and supports going back to edit any prior stage before final submission.
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
import { Button, Card, ErrorMessage, extractErrorMessage } from "../../components/ui";
import StageProgress from "../../components/StageProgress";
import EvidenceSidebar from "./EvidenceSidebar";
import EvidenceReviewStage from "./EvidenceReviewStage";
import ObservationStage from "./ObservationStage";
import HypothesisStage from "./HypothesisStage";
import EvidenceStage from "./EvidenceStage";
import AlternativeReviewStage from "./AlternativeReviewStage";
import FinalReconstructionStage from "./FinalReconstructionStage";
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

  // Which stage the participant is currently viewing (may differ from
  // session.current_stage when editing a prior stage)
  const [viewingStage, setViewingStage] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const sessionRes = await api.get<ReconstructionSession>(`/sessions/${id}`);
      const s = sessionRes.data;
      setSession(s);

      if (viewingStage === null) {
        setViewingStage(s.current_stage);
      }

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

      if (s.current_stage >= 5) {
        const altRes = await api.get<AlternativeReviewItem[]>(`/sessions/${id}/alternative-review`);
        setAlternativeItems(altRes.data);
      }

      if (s.current_stage >= 7) {
        const detailRes = await api.get<ReconstructionSession & { final_reconstruction: FinalReconstruction | null }>(`/sessions/${id}`);
        setFinalReconstruction((detailRes.data as any).final_reconstruction);
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

  async function advanceTo(stageEndpoint: string, nextStage: number) {
    await api.post<ReconstructionSession>(`/sessions/${id}/${stageEndpoint}`);
    setViewingStage(nextStage);
    await loadAll();
  }

  function navigateToStage(stage: number) {
    if (session && stage <= session.current_stage) {
      setViewingStage(stage);
    }
  }

  if (loading) return <p className="text-slate-500">Loading session...</p>;
  if (error) return <ErrorMessage message={error} />;
  if (!session || !caseDetail) return <ErrorMessage message="Session not found." />;

  const currentView = viewingStage ?? session.current_stage;
  const isCompleted = session.current_stage === 7;

  return (
    <div>
      {/* Evidence sidebar — visible on all stages */}
      <EvidenceSidebar evidenceItems={caseDetail.evidence_items} />

      <Card className="mb-6 bg-slate-50">
        <p className="text-sm text-slate-500">Case</p>
        <h1 className="text-xl font-semibold text-slate-800">{caseDetail.title}</h1>
        {caseDetail.description && (
          <p className="text-sm text-slate-500 mt-1">{caseDetail.description}</p>
        )}
      </Card>

      <StageProgress currentStage={session.current_stage} />

      {/* Edit navigation — shown when past stage 1 and not completed */}
      {session.current_stage > 1 && !isCompleted && (
        <div className="flex flex-wrap gap-2 mb-6 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <p className="text-xs text-amber-700 font-medium w-full mb-1">
            Go back and edit a previous stage:
          </p>
          {[
            { stage: 1, label: "Observations" },
            { stage: 2, label: "Evidence Review" },
            { stage: 3, label: "Hypotheses" },
            { stage: 4, label: "Evidence Evaluation" },
            { stage: 5, label: "Alternative Review" },
          ]
            .filter((s) => s.stage < session.current_stage)
            .map((s) => (
              <Button
                key={s.stage}
                variant={currentView === s.stage ? "primary" : "secondary"}
                onClick={() => navigateToStage(s.stage)}
                className="text-xs"
              >
                {s.label}
              </Button>
            ))}
          {currentView !== session.current_stage && (
            <Button
              variant="ghost"
              onClick={() => setViewingStage(session.current_stage)}
              className="text-xs ml-auto"
            >
              Return to current stage →
            </Button>
          )}
        </div>
      )}

      {/* Stage 1: Observation */}
      {currentView === 1 && (
        <ObservationStage
          session={session}
          observations={observations}
          onObservationAdded={(obs) => setObservations((prev) => [...prev, obs])}
          onObservationUpdated={(obs) =>
            setObservations((prev) => prev.map((o) => (o.id === obs.id ? obs : o)))
          }
          onObservationDeleted={(obsId) =>
            setObservations((prev) => prev.filter((o) => o.id !== obsId))
          }
          onAdvance={() => advanceTo("advance-to-stage-2", 2)}
          isEditMode={session.current_stage > 1}
        />
      )}

      {/* Stage 2: Evidence Review */}
      {currentView === 2 && (
        <EvidenceReviewStage
          evidenceItems={caseDetail.evidence_items}
          onAdvance={() => advanceTo("advance-to-stage-3", 3)}
        />
      )}

      {/* Stage 3: Hypothesis Generation */}
      {currentView === 3 && (
        <HypothesisStage
          session={session}
          hypotheses={hypotheses}
          onHypothesisAdded={(h) => setHypotheses((prev) => [...prev, h])}
          onHypothesisUpdated={(h) =>
            setHypotheses((prev) => prev.map((x) => (x.id === h.id ? h : x)))
          }
          onHypothesisDeleted={(hId) =>
            setHypotheses((prev) => prev.filter((x) => x.id !== hId))
          }
          onAdvance={() => advanceTo("advance-to-stage-4", 4)}
          isEditMode={session.current_stage > 3}
        />
      )}

      {/* Stage 4: Evidence Evaluation */}
      {currentView === 4 && (
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
          onAdvance={() => advanceTo("advance-to-stage-5", 5)}
          isEditMode={session.current_stage > 4}
        />
      )}

      {/* Stage 5: Alternative Review */}
      {currentView === 5 && (
        <AlternativeReviewStage
          session={session}
          items={alternativeItems}
          hypotheses={hypotheses}
          evidenceItems={caseDetail.evidence_items}
          onItemAcknowledged={(item) =>
            setAlternativeItems((prev) => prev.map((x) => (x.id === item.id ? item : x)))
          }
          onAdvance={() => advanceTo("advance-to-stage-6", 6)}
          isEditMode={session.current_stage > 5}
        />
      )}

      {/* Stage 6: Final Reconstruction */}
      {currentView === 6 && !isCompleted && (
        <FinalReconstructionStage
          session={session}
          hypotheses={hypotheses}
          onSubmitted={async () => {
            await loadAll();
          }}
        />
      )}

      {/* Completed */}
      {isCompleted && finalReconstruction && (
        <SessionCompleteSummary
          session={session}
          hypotheses={hypotheses}
          finalReconstruction={finalReconstruction}
        />
      )}
    </div>
  );
}
