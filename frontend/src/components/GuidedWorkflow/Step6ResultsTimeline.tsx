import React, { useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import {
  CaseRecord,
  GraphResponse,
  InferResponse,
} from '../../types';
import { computeTimeMappingClient } from '../../utils/timeUtils';
import { SourceBadge } from '../SourceBadge';

interface Step6ResultsTimelineProps {
  caseData: CaseRecord;
  graph: GraphResponse;
  inferenceResult: InferResponse | null;
  evidence: Record<string, string>;
}

const KEY_RECONSTRUCTION_NODES = [
  'attempt_completed',
  'entry_method',
  'property_loss',
  'relationship',
  'offender_age_group',
  'offender_sex',
];

export const Step6ResultsTimeline: React.FC<Step6ResultsTimelineProps> = ({
  caseData,
  graph,
  inferenceResult,
  evidence,
}) => {
  const timeInfo = useMemo(() => {
    try {
      return computeTimeMappingClient({
        incident_date: caseData.incident_date,
        incident_time: caseData.incident_time,
        time_precision: caseData.time_precision,
        time_range_start: caseData.time_range_start,
        time_range_end: caseData.time_range_end,
        range_resolution: caseData.range_resolution,
      });
    } catch {
      return caseData.time_mapping || null;
    }
  }, [caseData]);

  const getNodeResult = (nodeId: string) => inferenceResult?.nodes?.[nodeId];

  const supportingEvidence = useMemo(() => {
    return Object.entries(evidence).map(([nodeId, stVal]) => {
      const nMeta = graph.nodes.find((n) => n.id === nodeId);
      const stMeta = nMeta?.states.find((s) => s.state === stVal);
      return {
        nodeId,
        friendlyName: nMeta?.friendly_name || nodeId,
        state: stVal,
        stateLabel: stMeta?.label || stVal,
        isUnknown: stVal === 'Unknown' || stVal === 'U',
      };
    });
  }, [evidence, graph.nodes]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Step 6: Reconstruction Results, Event Timeline & Uncertainty Analysis
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review the reconstructed event sequence, posterior estimates with Shannon entropy uncertainty ratings, and supporting vs. conflicting evidence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceBadge type="Investigator-entered" />
          <SourceBadge type="Model estimate" />
        </div>
      </div>

      {/* Probable Event Timeline (Preserving Original Entered Timestamp & Precision) */}
      <div
        data-testid="reconstruction-timeline"
        className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Reconstructed Crime Scene Timeline
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 italic">
            The model uses 6-hour time periods. Minute-level timestamps are Investigator-entered.
          </span>
        </div>

        <div className="relative pl-6 border-l-2 border-blue-500/50 space-y-5">
          {/* Phase 1: Temporal Context & Arrival */}
          <div className="relative">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-slate-900 absolute -left-[31px] top-1" />
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-blue-300">
                  1. Incident Window & Scene Context
                </div>
                <SourceBadge type="Investigator-entered" />
              </div>
              <div
                data-testid="timeline-entered-timestamp"
                className="text-sm font-mono font-bold text-slate-100"
              >
                Entered Timestamp:{' '}
                {timeInfo?.investigator_entered.formatted_display ||
                  `${caseData.incident_date || ''} (${caseData.time_precision})`}{' '}
                [Precision: {caseData.time_precision}]
              </div>
              <p className="text-xs text-slate-300">
                Mapped to BN 6-Hour Window:{' '}
                <strong>
                  {timeInfo?.model_mapping.time_period ||
                    'Unobserved / Multi-Period Marginalised'}
                </strong>{' '}
                | Day Type:{' '}
                <strong>{timeInfo?.model_mapping.day_type || 'Unset'}</strong> |
                Scene Location:{' '}
                <strong>
                  {getNodeResult('location')?.top_state.label ||
                    caseData.location}
                </strong>
              </p>
            </div>
          </div>

          {/* Phase 2: Point of Entry */}
          <div className="relative">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-slate-900 absolute -left-[31px] top-1" />
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-red-300">
                  2. Target Access & Method of Entry
                </div>
                <SourceBadge
                  type={
                    evidence.entry_method
                      ? 'Investigator-entered'
                      : 'Model estimate'
                  }
                />
              </div>
              {getNodeResult('entry_method') && (
                <div className="text-xs text-slate-200">
                  Primary Entry Method:{' '}
                  <strong className="text-slate-100">
                    {getNodeResult('entry_method')!.top_state.label}
                  </strong>{' '}
                  (Posterior:{' '}
                  <span className="font-mono font-bold text-emerald-300">
                    {(
                      (getNodeResult('entry_method')!.top_state.posterior ?? 0) *
                      100
                    ).toFixed(2)}
                    %
                  </span>
                  , Uncertainty:{' '}
                  {getNodeResult('entry_method')!.entropy.uncertainty_level})
                </div>
              )}
            </div>
          </div>

          {/* Phase 3: Offense Execution & Completion */}
          <div className="relative">
            <span className="w-3.5 h-3.5 rounded-full bg-purple-500 border-2 border-slate-900 absolute -left-[31px] top-1" />
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-purple-300">
                  3. Burglary Execution & Completion Outcome
                </div>
                <SourceBadge
                  type={
                    evidence.attempt_completed
                      ? 'Investigator-entered'
                      : 'Model estimate'
                  }
                />
              </div>
              {getNodeResult('attempt_completed') && (
                <div className="text-xs text-slate-200">
                  Most Probable Outcome:{' '}
                  <strong className="text-slate-100">
                    {getNodeResult('attempt_completed')!.top_state.label}
                  </strong>{' '}
                  (Posterior:{' '}
                  <span className="font-mono font-bold text-emerald-300">
                    {(
                      (getNodeResult('attempt_completed')!.top_state
                        .posterior ?? 0) * 100
                    ).toFixed(2)}
                    %
                  </span>
                  , Entropy:{' '}
                  {getNodeResult(
                    'attempt_completed'
                  )!.entropy.entropy_bits.toFixed(2)}{' '}
                  bits —{' '}
                  {
                    getNodeResult('attempt_completed')!.entropy
                      .uncertainty_level
                  }{' '}
                  uncertainty)
                </div>
              )}
            </div>
          </div>

          {/* Phase 4: Property Loss & Offender Profile */}
          <div className="relative">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 absolute -left-[31px] top-1" />
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-emerald-300">
                  4. Property Impact & Suspect / Relationship Profile
                </div>
                <SourceBadge type="Model estimate" />
              </div>
              <div className="text-xs text-slate-200 space-y-1">
                {getNodeResult('property_loss') && (
                  <div>
                    Expected Property Loss:{' '}
                    <strong>
                      {getNodeResult('property_loss')!.top_state.label}
                    </strong>{' '}
                    (
                    {(
                      (getNodeResult('property_loss')!.top_state.posterior ??
                        0) * 100
                    ).toFixed(1)}
                    %)
                  </div>
                )}
                {getNodeResult('offender_age_group') && (
                  <div>
                    Offender Age Distribution Top Estimate:{' '}
                    <strong>
                      {getNodeResult('offender_age_group')!.top_state.label}
                    </strong>{' '}
                    (
                    {(
                      (getNodeResult('offender_age_group')!.top_state
                        .posterior ?? 0) * 100
                    ).toFixed(1)}
                    % — Uncertainty:{' '}
                    {
                      getNodeResult('offender_age_group')!.entropy
                        .uncertainty_level
                    }
                    )
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Reconstruction Estimates & Uncertainty Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-100">
          Key Variable Posterior Estimates & Entropy Uncertainty Indicators
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {KEY_RECONSTRUCTION_NODES.map((nodeId) => {
            const res = getNodeResult(nodeId);
            if (!res) return null;
            const uLevel = res.entropy.uncertainty_level;

            return (
              <div
                key={nodeId}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">
                    {res.friendly_name}
                  </span>
                  <SourceBadge
                    type={
                      res.is_evidence
                        ? res.evidence_state === 'Unknown'
                          ? 'Missing/Unknown'
                          : 'Investigator-entered'
                        : 'Model estimate'
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  {res.states.slice(0, 3).map((st) => (
                    <div key={st.state} className="text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-slate-300 truncate">
                          {st.label}
                        </span>
                        <span className="font-mono font-bold text-slate-100">
                          {((st.posterior ?? st.prior) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              (st.posterior ?? st.prior) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Uncertainty Rating:</span>
                  <span
                    className={`font-bold ${
                      uLevel === 'Low' || uLevel === 'Observed (Evidence)'
                        ? 'text-emerald-400'
                        : uLevel === 'Medium'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {uLevel} (H = {res.entropy.entropy_bits.toFixed(2)}b)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supporting & Conflicting Evidence Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Active Supporting Evidence ({supportingEvidence.length} Clamped)
            </h3>
            <SourceBadge type="Investigator-entered" />
          </div>
          {supportingEvidence.length === 0 ? (
            <p className="text-xs text-slate-400">
              No evidence clamped — showing unconditional baseline priors.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {supportingEvidence.map((item) => (
                <li
                  key={item.nodeId}
                  className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                >
                  <span className="text-slate-300">{item.friendlyName}</span>
                  <span className="font-semibold text-blue-300">
                    {item.stateLabel} [{item.state}]
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              Contradictions & Caveats
            </h3>
            <SourceBadge type="Missing/Unknown" />
          </div>
          {caseData.conflicts && caseData.conflicts.length > 0 ? (
            <div className="space-y-2">
              {caseData.conflicts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-lg bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    {c.title}
                  </div>
                  <p className="mt-1 text-slate-300">{c.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                No contradictory evidence flags detected in the current case record.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
