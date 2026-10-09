import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeTimeMappingClient } from '../utils/timeUtils';
import { Step1CaseDetails } from '../components/GuidedWorkflow/Step1CaseDetails';
import { Step6ResultsTimeline } from '../components/GuidedWorkflow/Step6ResultsTimeline';
import { GraphWorkspace } from '../components/GraphWorkspace';
import { GraphResponse, CaseRecord, InferResponse } from '../types';

const TWELVE_MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const TWENTY_NODE_IDS = [
  'incident_month',
  'day_type',
  'time_period',
  'location',
  'entry_method',
  'attempt_completed',
  'cleared_except_id',
  'num_premises_entered',
  'victim_type',
  'victim_age_group',
  'victim_sex',
  'victim_ethnicity',
  'resident_status',
  'relationship',
  'offender_age_group',
  'offender_sex',
  'offender_ethnicity',
  'property_loss',
  'property_stolen',
  'property_recovered',
];

const MOCK_GRAPH: GraphResponse = {
  node_count: 20,
  edge_count: 19,
  is_dag: true,
  notice: 'Model estimates are based on historical NIBRS burglary data and are not proof.',
  groups: [
    { name: 'Time', color: '#3b82f6' },
    { name: 'Incident', color: '#ef4444' },
    { name: 'Victim', color: '#10b981' },
    { name: 'Offender/Relationship', color: '#f59e0b' },
    { name: 'Property', color: '#8b5cf6' },
  ],
  nodes: TWENTY_NODE_IDS.map((id) => ({
    id,
    friendly_name:
      id === 'attempt_completed'
        ? 'Offense Completion Status'
        : id === 'entry_method'
        ? 'Method of Entry'
        : id,
    description: `Description for ${id}`,
    group: 'Incident',
    color: '#3b82f6',
    supports_unknown_state: id !== 'entry_method' && id !== 'attempt_completed',
    parents: [],
    children: [],
    spouses: [],
    markov_blanket: [],
    prior_entropy: {
      entropy_bits: 0.45,
      normalized_entropy: 0.45,
      uncertainty_level: 'Medium',
    },
    states:
      id === 'entry_method'
        ? [
            { state: 'F', label: 'Forced Entry', code: 'F', tooltip: 'Force', prior: 0.65 },
            { state: 'N', label: 'Non-Forced Entry', code: 'N', tooltip: 'No Force', prior: 0.35 },
          ]
        : id === 'attempt_completed'
        ? [
            { state: 'A', label: 'Attempted Burglary', code: 'A', tooltip: 'Attempted', prior: 0.08 },
            { state: 'C', label: 'Completed Burglary', code: 'C', tooltip: 'Completed', prior: 0.92 },
          ]
        : id === 'incident_month'
        ? TWELVE_MONTHS.map((m) => ({
            state: m,
            label: `Month ${m}`,
            code: m,
            tooltip: m,
            prior: 1 / 12,
          }))
        : [
            { state: '35', label: 'Residence/Home', code: '35', tooltip: 'Home', prior: 0.7 },
            { state: 'Unknown', label: 'Unknown', code: 'Unknown', tooltip: 'Unknown', prior: 0.3 },
          ],
  })),
  edges: [
    {
      id: 'entry_method->attempt_completed',
      source: 'entry_method',
      target: 'attempt_completed',
      source_friendly: 'Method of Entry',
      target_friendly: 'Offense Completion Status',
      description: 'Forced entry influences completion probability.',
    },
  ],
};

function makeMockInferResponse(evidence: Record<string, string>): InferResponse {
  const isForced = evidence.entry_method === 'F';
  const nodesMap: InferResponse['nodes'] = {};
  for (const n of MOCK_GRAPH.nodes) {
    if (n.id === 'attempt_completed') {
      const cProb = isForced ? 0.9592 : 0.915;
      const aProb = Number((1 - cProb).toFixed(4));
      nodesMap[n.id] = {
        node: n.id,
        friendly_name: n.friendly_name,
        group: n.group,
        is_evidence: Boolean(evidence[n.id]),
        top_state: {
          state: 'C',
          label: 'Completed Burglary',
          code: 'C',
          tooltip: 'Completed',
          prior: 0.92,
          posterior: cProb,
          delta: cProb - 0.92,
        },
        states: [
          {
            state: 'C',
            label: 'Completed Burglary',
            code: 'C',
            tooltip: 'Completed',
            prior: 0.92,
            posterior: cProb,
            delta: cProb - 0.92,
          },
          {
            state: 'A',
            label: 'Attempted Burglary',
            code: 'A',
            tooltip: 'Attempted',
            prior: 0.08,
            posterior: aProb,
            delta: aProb - 0.08,
          },
        ],
        entropy: {
          entropy_bits: isForced ? 0.246 : 0.41,
          normalized_entropy: isForced ? 0.246 : 0.41,
          uncertainty_level: isForced ? 'Low' : 'Medium',
        },
      };
    } else {
      nodesMap[n.id] = {
        node: n.id,
        friendly_name: n.friendly_name,
        group: n.group,
        is_evidence: Boolean(evidence[n.id]),
        evidence_state: evidence[n.id] || null,
        top_state: { ...n.states[0], posterior: n.states[0].prior, delta: 0 },
        states: n.states.map((s) => ({ ...s, posterior: s.prior, delta: 0 })),
        entropy: n.prior_entropy,
      };
    }
  }
  return {
    method: 'exact',
    evidence,
    query_vars: ['attempt_completed'],
    nodes: nodesMap,
    query_results: { attempt_completed: nodesMap.attempt_completed },
    notice: MOCK_GRAPH.notice,
  };
}

describe('Probabilistic Crime Scene Reconstruction Frontend Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/sensitivity')) {
        return {
          ok: true,
          json: async () => ({
            query_var: 'attempt_completed',
            query_friendly_name: 'Offense Completion Status',
            base_entropy: { entropy_bits: 0.4, normalized_entropy: 0.4, uncertainty_level: 'Medium' },
            rankings: [],
            notice: MOCK_GRAPH.notice,
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as any;
  });

  it('1. renders all 20 Bayesian Network nodes in the interactive graph', async () => {
    const initialInfer = makeMockInferResponse({});
    render(
      <div style={{ width: 1200, height: 800 }}>
        <GraphWorkspace
          graph={MOCK_GRAPH}
          evidence={{}}
          onChangeEvidence={() => {}}
          queryVar="attempt_completed"
          onChangeQueryVar={() => {}}
          inferenceResult={initialInfer}
          onRunInference={() => {}}
          isInferring={false}
          presets={[]}
        />
      </div>
    );

    for (const nodeId of TWENTY_NODE_IDS) {
      expect(screen.getByTestId(`bn-node-${nodeId}`)).toBeInTheDocument();
    }
  });

  it('2. setting evidence on a node updates posterior probabilities', async () => {
    const Wrapper = () => {
      const [ev, setEv] = React.useState<Record<string, string>>({});
      const inf = React.useMemo(() => makeMockInferResponse(ev), [ev]);
      return (
        <div style={{ width: 1200, height: 800 }}>
          <GraphWorkspace
            graph={MOCK_GRAPH}
            evidence={ev}
            onChangeEvidence={setEv}
            queryVar="attempt_completed"
            onChangeQueryVar={() => {}}
            inferenceResult={inf}
            onRunInference={() => {}}
            isInferring={false}
            presets={[]}
          />
        </div>
      );
    };

    render(<Wrapper />);

    // Before setting evidence, Completed Burglary is 91.50% in the Node Inspector
    expect(screen.getByText('91.50%')).toBeInTheDocument();

    // Click on entry_method node and set evidence to 'F' (Forced Entry)
    fireEvent.click(screen.getByTestId('bn-node-entry_method'));
    const select = screen.getByTestId('inspector-evidence-select');
    fireEvent.change(select, { target: { value: 'F' } });

    // Select attempt_completed node again and verify updated posterior 95.92%
    fireEvent.click(screen.getByTestId('bn-node-attempt_completed'));
    await waitFor(() => {
      expect(screen.getByText('95.92%')).toBeInTheDocument();
    });
  });

  it('3. date/time inputs handle typed, picked, approximate, range, unknown, and invalid input', () => {
    // Exact time: 2026-10-09 at 19:35 -> 09 Oct 2026, 19:35, Month 10, Weekday, Evening
    const exactRes = computeTimeMappingClient({
      incident_date: '2026-10-09',
      incident_time: '19:35',
      time_precision: 'Exact',
    });
    expect(exactRes.investigator_entered.formatted_display).toBe('09 Oct 2026, 19:35');
    expect(exactRes.model_mapping.incident_month).toBe('10');
    expect(exactRes.model_mapping.day_type).toBe('Weekday');
    expect(exactRes.model_mapping.time_period).toBe('Evening');

    // Approximate range inside one period (13:00-16:30 -> Afternoon)
    const singleRange = computeTimeMappingClient({
      incident_date: '2026-10-10',
      time_precision: 'Approximate',
      time_range_start: '13:00',
      time_range_end: '16:30',
    });
    expect(singleRange.model_mapping.day_type).toBe('Weekend');
    expect(singleRange.model_mapping.time_period).toBe('Afternoon');
    expect(singleRange.model_mapping.spans_multiple_periods).toBe(false);

    // Approximate range spanning periods (04:30-07:30 -> Night & Morning, not collapsed silently)
    const spanRange = computeTimeMappingClient({
      incident_date: '2026-10-09',
      time_precision: 'Approximate',
      time_range_start: '04:30',
      time_range_end: '07:30',
    });
    expect(spanRange.model_mapping.spans_multiple_periods).toBe(true);
    expect(spanRange.model_mapping.spanned_periods).toEqual(['Night', 'Morning']);
    expect(spanRange.model_mapping.time_period).toBeNull();
    expect(spanRange.model_mapping.candidate_scenarios).toHaveLength(2);

    // Time Unknown -> sets time_period to 'Unknown' without inventing an hour
    const unkRes = computeTimeMappingClient({
      incident_date: '2026-10-09',
      time_precision: 'Time Unknown',
    });
    expect(unkRes.investigator_entered.incident_time).toBeNull();
    expect(unkRes.model_mapping.time_period).toBe('Unknown');

    // Invalid time input -> throws friendly error
    expect(() =>
      computeTimeMappingClient({
        incident_date: '2026-10-09',
        incident_time: '29:99',
        time_precision: 'Exact',
      })
    ).toThrow(/Invalid incident time/i);

    // Component UI verification for Step1CaseDetails
    const WrapperStep1 = () => {
      const [c, setC] = React.useState<CaseRecord>({
        id: 'c1',
        case_number: 'NY-2026-01',
        title: 'Test Case',
        summary: '',
        incident_date: '2026-10-09',
        incident_time: '19:35',
        time_precision: 'Exact',
        time_range_start: null,
        time_range_end: null,
        range_resolution: null,
        location: '35',
        address_notes: '',
        victims: [],
        suspects: [],
        evidence_files: [],
        observations: [],
        manual_evidence: {},
        query_var: 'attempt_completed',
      });
      return (
        <Step1CaseDetails
          caseData={c}
          graph={MOCK_GRAPH}
          onUpdateCase={(u) => setC((prev) => ({ ...prev, ...u }))}
        />
      );
    };

    render(<WrapperStep1 />);
    expect(screen.getByTestId('formatted-timestamp-display')).toHaveTextContent(
      '09 Oct 2026, 19:35'
    );

    // Type invalid time and check plain-English error message
    fireEvent.change(screen.getByTestId('incident-time-input'), {
      target: { value: '99:99' },
    });
    expect(screen.getByTestId('datetime-error-msg')).toHaveTextContent(
      /valid 24-hour time/i
    );
  });

  it('4. timeline shows the original entered time and precision labeled Investigator-entered', () => {
    const mockCase: CaseRecord = {
      id: 'c-timeline',
      case_number: 'NY-2026-099',
      title: 'Timeline Verification Case',
      summary: 'Testing original entered timestamp in timeline',
      incident_date: '2026-10-09',
      incident_time: '19:35',
      time_precision: 'Approximate',
      time_range_start: '18:45',
      time_range_end: '20:15',
      range_resolution: null,
      location: '35',
      address_notes: '',
      victims: [],
      suspects: [],
      evidence_files: [],
      observations: [],
      manual_evidence: { location: '35', entry_method: 'F' },
      query_var: 'attempt_completed',
    };

    render(
      <Step6ResultsTimeline
        caseData={mockCase}
        graph={MOCK_GRAPH}
        inferenceResult={makeMockInferResponse(mockCase.manual_evidence)}
        evidence={mockCase.manual_evidence}
      />
    );

    const tsNode = screen.getByTestId('timeline-entered-timestamp');
    expect(tsNode).toHaveTextContent('09 Oct 2026, Approx. 18:45–20:15');
    expect(tsNode).toHaveTextContent('[Precision: Approximate]');
    expect(screen.getAllByText('Investigator-entered').length).toBeGreaterThan(0);
    expect(screen.getByText(/The model uses 6-hour time periods/i)).toBeInTheDocument();
  });

  it('5. flags conflicting evidence observations in Step 4 Evidence Review', async () => {
    const { Step4EvidenceReview } = await import(
      '../components/GuidedWorkflow/Step4EvidenceReview'
    );
    const conflictCase: CaseRecord = {
      id: 'c-conflict',
      case_number: 'NY-2026-CONF',
      title: 'Conflict Test Case',
      summary: '',
      incident_date: '2026-10-09',
      incident_time: '02:15',
      time_precision: 'Exact',
      time_range_start: null,
      time_range_end: null,
      range_resolution: null,
      location: '35',
      address_notes: '',
      victims: [],
      suspects: [],
      evidence_files: [],
      observations: [
        {
          id: 'o1',
          label: 'Witness Reported Forced Door',
          category: 'Witness',
          status: 'Present',
          mapped_node: 'entry_method',
          present_state: 'F',
          absent_state: 'N',
          source_type: 'Investigator-entered',
          notes: '',
        },
        {
          id: 'o2',
          label: 'Lock Inspection Documented No Force',
          category: 'Forensic',
          status: 'Present',
          mapped_node: 'entry_method',
          present_state: 'N',
          absent_state: 'F',
          source_type: 'Uploaded evidence',
          notes: '',
        },
      ],
      manual_evidence: {},
      query_var: 'attempt_completed',
    };

    render(
      <Step4EvidenceReview
        caseData={conflictCase}
        graph={MOCK_GRAPH}
        onUpdateCase={() => {}}
        onNavigateToGraph={() => {}}
      />
    );

    expect(screen.getByTestId('evidence-conflict-banner')).toBeInTheDocument();
    expect(screen.getByText(/Conflicting Evidence on Method of Entry/i)).toBeInTheDocument();
  });
});
