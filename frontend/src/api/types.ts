/**
 * TypeScript interfaces mirroring the backend Pydantic schemas
 * (app/schemas/*.py). Keeping these in sync manually is acceptable for
 * a research prototype of this size; for larger projects consider
 * generating these from the OpenAPI schema (e.g. via openapi-typescript).
 */

// ---------- Auth ----------

export type UserRole = "participant" | "researcher";

export interface User {
  id: number;
  username: string;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

// ---------- Cases & Evidence ----------

export interface EvidenceItem {
  id: number;
  case_id: number;
  label: string;
  description: string;
  file_path: string | null;
  is_contradictory_by_design?: boolean; // researcher view only
  created_at: string;
}

export interface Case {
  id: number;
  title: string;
  description: string | null;
  bayesian_enabled: boolean;
  created_by?: number;
  created_at?: string;
  is_active?: boolean;
}

export interface CaseDetail extends Case {
  evidence_items: EvidenceItem[];
}

// ---------- Sessions ----------

export interface ReconstructionSession {
  id: number;
  participant_id: number;
  case_id: number;
  current_stage: number; // 1-5, 6 = completed
  started_at: string;
  completed_at: string | null;
  bayesian_enabled_snapshot: boolean;
}

// ---------- Stage 1: Observation ----------

export interface Observation {
  id: number;
  session_id: number;
  observation_text: string;
  source: string;
  observed_timestamp: string | null;
  created_at: string;
}

// ---------- Stage 2: Hypothesis ----------

export interface Hypothesis {
  id: number;
  session_id: number;
  title: string;
  description: string;
  initial_confidence: number;
  current_confidence: number;
  abandoned_at: string | null;
  is_retained_at_final: boolean;
  bayesian_prior: number | null;
  created_at: string;
}

export interface HypothesisRevision {
  id: number;
  hypothesis_id: number;
  previous_confidence: number;
  new_confidence: number;
  rationale: string | null;
  created_at: string;
}

// ---------- Stage 3: Evidence-Hypothesis Links ----------

export type Stance =
  | "supports"
  | "weakly_supports"
  | "neutral"
  | "weakly_contradicts"
  | "contradicts";

export interface EvidenceLink {
  id: number;
  session_id: number;
  evidence_item_id: number;
  hypothesis_id: number;
  stance: Stance;
  stance_value: number;
  likelihood_ratio: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface EvidenceReviewStatus {
  total_evidence_items: number;
  reviewed_evidence_items: number;
  unreviewed_evidence_item_ids: number[];
  all_reviewed: boolean;
}

// ---------- Stage 4: Alternative Review ----------

export type AlternativeItemType =
  | "alternative_hypothesis"
  | "contradictory_evidence"
  | "unassigned_evidence";

export interface AlternativeReviewItem {
  id: number;
  session_id: number;
  item_type: AlternativeItemType;
  hypothesis_id: number | null;
  evidence_item_id: number | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  reflection_note: string | null;
  created_at: string;
}

// ---------- Stage 5: Final Reconstruction ----------

export interface FinalReconstruction {
  id: number;
  session_id: number;
  selected_hypothesis_id: number;
  final_narrative: string;
  final_confidence: number;
  accuracy_score: number | null;
  scored_at: string | null;
  created_at: string;
}

// ---------- Metrics ----------

export interface SessionMetrics {
  session_id: number;
  num_hypotheses_generated: number;
  num_hypothesis_revisions: number;
  num_evidence_hypothesis_links: number;
  num_alternatives_retained_at_final: number;
  num_contradictory_acknowledgements: number;
  hypothesis_flexibility_score: number | null;

  time_to_first_preferred_hypothesis_seconds: number | null;
  num_hypotheses_abandoned_early: number;
  num_contradictory_evidence_ignored: number;
  num_evidence_reviewed_before_final: number;
  premature_closure_score: number | null;

  initial_confidence_of_selected: number | null;
  final_confidence: number | null;
  final_accuracy: number | null;
  calibration_error: number | null;

  computed_at: string;
}

// ---------- Bayesian ----------

export interface EvidenceConsideredEntry {
  evidence_item_id: number;
  label: string;
  stance: Stance;
  likelihood_ratio: number;
}

export interface BayesianUpdate {
  id: number;
  hypothesis_id: number;
  prior_probability: number;
  posterior_probability: number;
  evidence_considered: EvidenceConsideredEntry[];
  created_at: string;
}

export interface BayesianHypothesisSummary {
  hypothesis_id: number;
  hypothesis_title: string;
  prior: number | null;
  latest_posterior: number | null;
  trail: BayesianUpdate[];
}
