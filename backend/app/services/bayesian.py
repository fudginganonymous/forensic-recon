"""
Bayesian module service.

Fully independent computation engine for the optional Bayesian
decision-support module. Uses odds-form Bayesian updating:

    posterior_odds = prior_odds * Π(likelihood_ratios)
    posterior_prob = posterior_odds / (1 + posterior_odds)

A likelihood ratio > 1 means the evidence supports the hypothesis
(increases odds); < 1 means it counts against it. Participants assign
likelihood ratios per evidence-hypothesis link (Stage 3,
EvidenceHypothesisLink.likelihood_ratio). If a link has no
likelihood_ratio set, a default derived from its categorical `stance`
is used (see STANCE_TO_DEFAULT_LR) so the module still works for
participants who skip manual likelihood entry.

This module never blocks or is required for workflow progression - it
is purely additive and only invoked via its own router endpoints.
"""
import json
from typing import Optional

from sqlalchemy.orm import Session as DBSession

from app.models.hypothesis import Hypothesis
from app.models.evidence_link import EvidenceHypothesisLink
from app.models.bayesian import BayesianUpdate

# Default likelihood ratios applied when a participant has not specified
# one manually, derived from the categorical stance. These are
# illustrative defaults and should be reviewed/justified in the
# dissertation methodology if the Bayesian module is used in analysis.
STANCE_TO_DEFAULT_LR = {
    "contradicts": 0.2,
    "weakly_contradicts": 0.6,
    "neutral": 1.0,
    "weakly_supports": 1.6,
    "supports": 3.0,
}


def compute_posterior(db: DBSession, hypothesis: Hypothesis, prior_override: Optional[float] = None) -> BayesianUpdate:
    """
    Compute the posterior probability for `hypothesis` given all
    EvidenceHypothesisLink rows currently recorded for it, and persist
    the result as a new BayesianUpdate (reasoning trail entry).
    """
    prior = prior_override if prior_override is not None else hypothesis.bayesian_prior
    if prior is None:
        prior = 0.5  # uninformative default prior

    # Guard against degenerate priors of exactly 0 or 1
    prior = min(max(prior, 1e-6), 1 - 1e-6)
    prior_odds = prior / (1 - prior)

    links = (
        db.query(EvidenceHypothesisLink)
        .filter(EvidenceHypothesisLink.hypothesis_id == hypothesis.id)
        .all()
    )

    posterior_odds = prior_odds
    evidence_considered = []
    for link in links:
        lr = link.likelihood_ratio
        if lr is None:
            lr = STANCE_TO_DEFAULT_LR.get(link.stance, 1.0)
        posterior_odds *= lr
        evidence_considered.append({
            "evidence_item_id": link.evidence_item_id,
            "label": link.evidence_item.label if link.evidence_item else f"Item {link.evidence_item_id}",
            "stance": link.stance,
            "likelihood_ratio": lr,
        })

    posterior_prob = posterior_odds / (1 + posterior_odds)

    update = BayesianUpdate(
        hypothesis_id=hypothesis.id,
        prior_probability=prior,
        posterior_probability=posterior_prob,
        evidence_considered=json.dumps(evidence_considered),
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    return update
