"""
Controlled vocabulary for ActivityLog.event_type.

Keeping this centralised ensures metric calculations
(app/services/metrics.py) and the logging calls throughout the routers
stay in sync. Add new event types here first.
"""

SESSION_STARTED = "session_started"
STAGE_ADVANCED = "stage_advanced"

OBSERVATION_CREATED = "observation_created"

HYPOTHESIS_CREATED = "hypothesis_created"
HYPOTHESIS_REVISED = "hypothesis_revised"
HYPOTHESIS_ABANDONED = "hypothesis_abandoned"
HYPOTHESIS_BECAME_PREFERRED = "hypothesis_became_preferred"

EVIDENCE_LINK_CREATED = "evidence_link_created"
EVIDENCE_LINK_UPDATED = "evidence_link_updated"

ALTERNATIVE_ACKNOWLEDGED = "alternative_acknowledged"

BAYESIAN_UPDATE_COMPUTED = "bayesian_update_computed"

FINAL_RECONSTRUCTION_SUBMITTED = "final_reconstruction_submitted"
SESSION_COMPLETED = "session_completed"
