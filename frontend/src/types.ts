export interface EntropyMetrics {
  entropy_bits: number;
  max_entropy_bits?: number;
  normalized_entropy: number;
  uncertainty_level: 'Low' | 'Medium' | 'High' | 'Observed (Evidence)';
}

export interface NodeStateMeta {
  state: string;
  label: string;
  code: string;
  tooltip: string;
  prior: number;
  posterior?: number;
  delta?: number;
  exact_posterior?: number;
  gibbs_posterior?: number;
  abs_error?: number;
}

export interface GraphNodeMeta {
  id: string;
  friendly_name: string;
  description: string;
  group: 'Time' | 'Incident' | 'Victim' | 'Offender/Relationship' | 'Property';
  color: string;
  states: NodeStateMeta[];
  supports_unknown_state: boolean;
  parents: string[];
  children: string[];
  spouses: string[];
  markov_blanket: string[];
  prior_entropy: EntropyMetrics;
}

export interface GraphEdgeMeta {
  id: string;
  source: string;
  target: string;
  source_friendly: string;
  target_friendly: string;
  description: string;
}

export interface GraphGroupMeta {
  name: string;
  color: string;
}

export interface GraphResponse {
  node_count: number;
  edge_count: number;
  is_dag: boolean;
  nodes: GraphNodeMeta[];
  edges: GraphEdgeMeta[];
  groups: GraphGroupMeta[];
  notice: string;
}

export interface NodeInferenceResult {
  node: string;
  friendly_name: string;
  group: string;
  is_evidence: boolean;
  evidence_state?: string | null;
  evidence_label?: string | null;
  top_state: NodeStateMeta;
  states: NodeStateMeta[];
  entropy: EntropyMetrics;
}

export interface InferResponse {
  method: 'exact' | 'gibbs' | 'both';
  samples?: number | null;
  burn_in?: number | null;
  evidence: Record<string, string>;
  query_vars: string[];
  nodes: Record<string, NodeInferenceResult>;
  query_results: Record<string, NodeInferenceResult>;
  notice: string;
}

export interface PresetScenario {
  id: string;
  name: string;
  description: string;
  evidence: Record<string, string>;
  query_var: string;
  source: string;
}

export interface EvaluatedScenario {
  name: string;
  evidence: Record<string, string>;
  readable_evidence: Array<{
    node: string;
    friendly_name: string;
    state: string;
    state_label: string;
  }>;
  states: Array<{
    state: string;
    label: string;
    code: string;
    posterior: number;
    prior: number;
    delta: number;
  }>;
  top_state: {
    state: string;
    label: string;
    code: string;
    posterior: number;
    prior: number;
    delta: number;
  };
  entropy: EntropyMetrics;
  evidence_prior_prob: number;
  evidence_log10_prob: number;
}

export interface ScenarioCompareResponse {
  query_var: string;
  query_friendly_name: string;
  scenarios: EvaluatedScenario[];
  summary: string;
  summary_points: string[];
  notice: string;
}

export interface SensitivityRankingItem {
  node: string;
  friendly_name: string;
  group: string;
  expected_kl_bits: number;
  entropy_reduction_bits: number;
  max_posterior_shift: number;
  most_impactful_observation?: {
    candidate_state: string;
    candidate_state_label: string;
    affected_query_state: string;
    affected_query_state_label: string;
    base_prob: number;
    new_prob: number;
    max_prob_shift: number;
    kl_bits: number;
  } | null;
  explanation: string;
}

export interface SensitivityResponse {
  query_var: string;
  query_friendly_name: string;
  base_entropy: EntropyMetrics;
  rankings: SensitivityRankingItem[];
  notice: string;
}

export interface CPDTableResponse {
  node: string;
  friendly_name: string;
  parents: string[];
  parent_friendly_names: string[];
  states: Array<{ state: string; label: string }>;
  total_columns: number;
  columns: Array<{
    column_key: string;
    parent_states: Record<string, string>;
    parent_labels: string;
    probabilities: Record<string, number>;
  }>;
}

export interface HMMStateInfo {
  state: number;
  name: string;
  short: string;
  color: string;
  description: string;
  mean_crime_count: number;
  observation_count: number;
  proportion: number;
  initial_probability: number;
}

export interface HMMGridCell {
  month: number;
  month_name: string;
  time_period: string;
  crime_count: number;
  hidden_state: number;
  state_name: string;
  state_short: string;
  color: string;
}

export interface HMMOverviewResponse {
  n_states: number;
  overall_mean_count: number;
  overall_std_count: number;
  total_observations: number;
  period_order: string[];
  states: HMMStateInfo[];
  transition_matrix: number[][];
  transition_rows: Array<{
    from_state: number;
    from_name: string;
    to_probabilities: number[];
    transitions: Array<{
      to_state: number;
      to_name: string;
      probability: number;
    }>;
  }>;
  initial_probability: number[];
  grid: Array<{
    month: number;
    month_name: string;
    periods: Record<string, HMMGridCell>;
  }>;
  sequence_prediction: {
    last_observed_month: number;
    last_observed_period: string;
    last_state: number;
    last_state_name: string;
    next_state_probabilities: Array<{
      state: number;
      name: string;
      probability: number;
    }>;
    predicted_next_state: number;
    predicted_next_state_name: string;
  };
  scope_notice: string;
}

export interface HMMEstimateResponse {
  month: number;
  month_name: string;
  time_period: string;
  is_unknown_period: boolean;
  crime_count?: number;
  hidden_state?: number;
  state_name?: string;
  state_short?: string;
  color?: string;
  state_mean?: number;
  overall_mean?: number;
  next_state_probabilities?: Array<{
    state: number;
    name: string;
    short: string;
    probability: number;
  }>;
  predicted_next_state?: number;
  predicted_next_state_name?: string;
  month_breakdown?: Array<{
    time_period: string;
    crime_count: number;
    hidden_state: number;
    state_name: string;
    color: string;
  }>;
  explanation: string;
  scope_notice: string;
}

export interface VictimPerson {
  id: string;
  label: string;
  victim_type: string;
  victim_age_group: string;
  victim_sex: string;
  victim_ethnicity: string;
  resident_status: string;
  notes: string;
}

export interface SuspectPerson {
  id: string;
  label: string;
  relationship: string;
  offender_age_group: string;
  offender_sex: string;
  offender_ethnicity: string;
  notes: string;
}

export interface EvidenceFileItem {
  id: string;
  filename: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  status: 'Uploaded' | 'Processed' | 'Failed';
  uploaded_at: string;
  notes: string;
  source_label?: string;
}

export interface ObservationItem {
  id: string;
  label: string;
  category: string;
  status: 'Present' | 'Absent' | 'Unknown';
  mapped_node: string;
  present_state: string;
  absent_state?: string;
  source_type: 'Investigator-entered' | 'Uploaded evidence';
  notes: string;
}

export interface EvidenceConflict {
  id: string;
  severity: 'high' | 'medium';
  node: string;
  friendly_name: string;
  title: string;
  description: string;
}

export interface TimeMappingResult {
  investigator_entered: {
    incident_date: string | null;
    incident_time: string | null;
    time_precision: 'Exact' | 'Approximate' | 'Time Unknown';
    time_range_start: string | null;
    time_range_end: string | null;
    formatted_display: string;
    label: string;
  };
  model_mapping: {
    incident_month?: string | null;
    day_of_week?: string | null;
    day_type?: string | null;
    time_period?: string | null;
    spanned_periods: string[];
    spans_multiple_periods: boolean;
    range_resolution?: string | null;
    bn_evidence: Record<string, string>;
    candidate_scenarios: Array<{
      name: string;
      time_period: string;
      evidence: Record<string, string>;
    }>;
    warning?: string | null;
    error?: string | null;
    model_note: string;
  };
}

export interface CaseRecord {
  id: string;
  case_number: string;
  title: string;
  summary: string;
  incident_date: string;
  incident_time: string | null;
  time_precision: 'Exact' | 'Approximate' | 'Time Unknown';
  time_range_start: string | null;
  time_range_end: string | null;
  range_resolution: string | null;
  location: string;
  address_notes: string;
  victims: VictimPerson[];
  suspects: SuspectPerson[];
  evidence_files: EvidenceFileItem[];
  observations: ObservationItem[];
  manual_evidence: Record<string, string>;
  query_var: string;
  created_at?: string;
  updated_at?: string;
  time_mapping?: TimeMappingResult;
  conflicts?: EvidenceConflict[];
}
