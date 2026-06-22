"""
Import all models here so that Base.metadata.create_all() (called at
startup in main.py) discovers every table, and so relationship()
string references resolve correctly across modules.
"""
from app.models.user import User
from app.models.case import Case, EvidenceItem
from app.models.session import ReconstructionSession
from app.models.observation import Observation
from app.models.hypothesis import Hypothesis, HypothesisRevision
from app.models.evidence_link import EvidenceHypothesisLink, STANCE_VALUES
from app.models.acknowledgement import AlternativeAcknowledgement
from app.models.final_reconstruction import FinalReconstruction
from app.models.activity_log import ActivityLog
from app.models.metrics import SessionMetrics
from app.models.bayesian import BayesianUpdate

__all__ = [
    "User",
    "Case",
    "EvidenceItem",
    "ReconstructionSession",
    "Observation",
    "Hypothesis",
    "HypothesisRevision",
    "EvidenceHypothesisLink",
    "STANCE_VALUES",
    "AlternativeAcknowledgement",
    "FinalReconstruction",
    "ActivityLog",
    "SessionMetrics",
    "BayesianUpdate",
]
