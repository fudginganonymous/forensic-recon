"""
Researcher dashboard router.

Provides:
  - participant management / session overview
  - per-session metrics retrieval
  - activity log retrieval
  - CSV and Excel export of session-level metrics and raw event logs,
    formatted for direct import into SPSS and R.

All endpoints require the `require_researcher` dependency.
"""
import csv
import io
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
import pandas as pd

from app.db.session import get_db
from app.core.deps import require_researcher
from app.models.user import User
from app.models.case import Case
from app.models.session import ReconstructionSession
from app.models.activity_log import ActivityLog
from app.models.metrics import SessionMetrics
from app.schemas.metrics import SessionMetricsOut
from app.schemas.session import SessionOut, SessionDetailOut
from app.services.metrics import compute_session_metrics

router = APIRouter(prefix="/researcher", tags=["Researcher Dashboard"])


# ---------------------------------------------------------------------------
# Participant / session overview
# ---------------------------------------------------------------------------

@router.get("/sessions", response_model=List[SessionOut])
def list_all_sessions(
    case_id: Optional[int] = Query(None, description="Filter by case ID"),
    participant_id: Optional[int] = Query(None, description="Filter by participant ID"),
    researcher: User = Depends(require_researcher),
    db: DBSession = Depends(get_db),
):
    query = db.query(ReconstructionSession)
    if case_id is not None:
        query = query.filter(ReconstructionSession.case_id == case_id)
    if participant_id is not None:
        query = query.filter(ReconstructionSession.participant_id == participant_id)
    return query.order_by(ReconstructionSession.started_at.desc()).all()


@router.get("/sessions/{session_id}", response_model=SessionDetailOut)
def get_session_full(session_id: int, researcher: User = Depends(require_researcher), db: DBSession = Depends(get_db)):
    session = db.query(ReconstructionSession).filter(ReconstructionSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/participants", response_model=List[dict])
def list_participants(researcher: User = Depends(require_researcher), db: DBSession = Depends(get_db)):
    participants = db.query(User).filter(User.role == "participant").all()
    result = []
    for p in participants:
        result.append({
            "id": p.id,
            "username": p.username,
            "email": p.email,
            "is_active": p.is_active,
            "created_at": p.created_at,
            "num_sessions": len(p.sessions),
            "num_completed_sessions": sum(1 for s in p.sessions if s.current_stage == 6),
        })
    return result


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}/metrics", response_model=SessionMetricsOut)
def get_session_metrics(session_id: int, recompute: bool = Query(False), researcher: User = Depends(require_researcher), db: DBSession = Depends(get_db)):
    session = db.query(ReconstructionSession).filter(ReconstructionSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if recompute or session.metrics is None:
        metrics = compute_session_metrics(db, session)
    else:
        metrics = session.metrics

    return SessionMetricsOut(session_id=session_id, **{
        c.name: getattr(metrics, c.name) for c in SessionMetrics.__table__.columns if c.name not in ("id", "session_id")
    })


@router.get("/sessions/{session_id}/activity-log")
def get_activity_log(session_id: int, researcher: User = Depends(require_researcher), db: DBSession = Depends(get_db)):
    session = db.query(ReconstructionSession).filter(ReconstructionSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.session_id == session_id)
        .order_by(ActivityLog.created_at.asc())
        .all()
    )
    return [
        {
            "id": log.id,
            "event_type": log.event_type,
            "event_data": json.loads(log.event_data) if log.event_data else {},
            "stage_at_event": log.stage_at_event,
            "created_at": log.created_at,
        }
        for log in logs
    ]


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

def _build_metrics_dataframe(db: DBSession, case_id: Optional[int] = None) -> pd.DataFrame:
    """
    Build a flat, one-row-per-session dataframe of all metrics plus
    session/case/participant identifiers, suitable for SPSS/R import.
    Recomputes metrics for every session to ensure exports are current.
    """
    query = db.query(ReconstructionSession)
    if case_id is not None:
        query = query.filter(ReconstructionSession.case_id == case_id)
    sessions = query.all()

    rows = []
    for session in sessions:
        metrics = compute_session_metrics(db, session)
        row = {
            "session_id": session.id,
            "participant_id": session.participant_id,
            "participant_username": session.participant.username,
            "case_id": session.case_id,
            "case_title": session.case.title,
            "bayesian_enabled": session.bayesian_enabled_snapshot,
            "current_stage": session.current_stage,
            "completed": session.current_stage == 6,
            "started_at": session.started_at,
            "completed_at": session.completed_at,
        }
        for col in SessionMetrics.__table__.columns:
            if col.name not in ("id", "session_id"):
                row[col.name] = getattr(metrics, col.name)
        rows.append(row)

    return pd.DataFrame(rows)


@router.get("/export/metrics.csv")
def export_metrics_csv(case_id: Optional[int] = Query(None), researcher: User = Depends(require_researcher), db: DBSession = Depends(get_db)):
    """
    Export session-level metrics as CSV. One row per session, columns
    are flat (no nested JSON), ready for SPSS/R import via standard
    read.csv() / read_csv() functions.
    """
    df = _build_metrics_dataframe(db, case_id)
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=session_metrics.csv"},
    )


@router.get("/export/metrics.xlsx")
def export_metrics_excel(case_id: Optional[int] = Query(None), researcher: User = Depends(require_researcher), db: DBSession = Depends(get_db)):
    """
    Export session-level metrics as an Excel workbook with two sheets:
      - 'Metrics': one row per session (as in the CSV export)
      - 'EventLog': raw activity log across all matching sessions, for
        exploratory/sequential analysis
    """
    df_metrics = _build_metrics_dataframe(db, case_id)

    session_ids = df_metrics["session_id"].tolist() if not df_metrics.empty else []
    logs = []
    if session_ids:
        log_rows = (
            db.query(ActivityLog)
            .filter(ActivityLog.session_id.in_(session_ids))
            .order_by(ActivityLog.session_id, ActivityLog.created_at)
            .all()
        )
        for log in log_rows:
            logs.append({
                "session_id": log.session_id,
                "event_type": log.event_type,
                "event_data": log.event_data,
                "stage_at_event": log.stage_at_event,
                "created_at": log.created_at,
            })
    df_logs = pd.DataFrame(logs)

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df_metrics.to_excel(writer, index=False, sheet_name="Metrics")
        df_logs.to_excel(writer, index=False, sheet_name="EventLog")
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=session_metrics.xlsx"},
    )


@router.get("/export/raw-data.csv")
def export_raw_workflow_csv(session_id: int = Query(...), researcher: User = Depends(require_researcher), db: DBSession = Depends(get_db)):
    """
    Export ALL raw workflow data for a single session (observations,
    hypotheses, revisions, evidence links, acknowledgements, final
    reconstruction) as a single CSV with a `record_type` column
    distinguishing row types. Useful for qualitative/detailed review of
    one participant's session.
    """
    session = db.query(ReconstructionSession).filter(ReconstructionSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    rows = []
    for o in session.observations:
        rows.append({"record_type": "observation", "id": o.id, "observation_text": o.observation_text,
                      "source": o.source, "observed_timestamp": o.observed_timestamp, "created_at": o.created_at})
    for h in session.hypotheses:
        rows.append({"record_type": "hypothesis", "id": h.id, "title": h.title, "description": h.description,
                      "initial_confidence": h.initial_confidence, "current_confidence": h.current_confidence,
                      "abandoned_at": h.abandoned_at, "is_retained_at_final": h.is_retained_at_final,
                      "created_at": h.created_at})
        for r in h.revisions:
            rows.append({"record_type": "hypothesis_revision", "id": r.id, "hypothesis_id": h.id,
                          "previous_confidence": r.previous_confidence, "new_confidence": r.new_confidence,
                          "rationale": r.rationale, "created_at": r.created_at})
    for link in session.evidence_links:
        rows.append({"record_type": "evidence_link", "id": link.id, "evidence_item_id": link.evidence_item_id,
                      "hypothesis_id": link.hypothesis_id, "stance": link.stance, "stance_value": link.stance_value,
                      "likelihood_ratio": link.likelihood_ratio, "created_at": link.created_at})
    for a in session.acknowledgements:
        rows.append({"record_type": "alternative_acknowledgement", "id": a.id, "item_type": a.item_type,
                      "hypothesis_id": a.hypothesis_id, "evidence_item_id": a.evidence_item_id,
                      "acknowledged": a.acknowledged, "acknowledged_at": a.acknowledged_at,
                      "reflection_note": a.reflection_note, "created_at": a.created_at})
    if session.final_reconstruction:
        f = session.final_reconstruction
        rows.append({"record_type": "final_reconstruction", "id": f.id,
                      "selected_hypothesis_id": f.selected_hypothesis_id, "final_narrative": f.final_narrative,
                      "final_confidence": f.final_confidence, "accuracy_score": f.accuracy_score,
                      "created_at": f.created_at})

    df = pd.DataFrame(rows)
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=session_{session_id}_raw_data.csv"},
    )
