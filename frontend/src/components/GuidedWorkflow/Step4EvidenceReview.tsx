import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowRightCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  CaseRecord,
  GraphResponse,
  ObservationItem,
  EvidenceConflict,
} from '../../types';
import { SourceBadge } from '../SourceBadge';

interface Step4EvidenceReviewProps {
  caseData: CaseRecord;
  graph: GraphResponse;
  onUpdateCase: (
    updated: Partial<CaseRecord>,
    syncEvidence?: Record<string, string>
  ) => void;
  onNavigateToGraph: () => void;
}

export const Step4EvidenceReview: React.FC<Step4EvidenceReviewProps> = ({
  caseData,
  graph,
  onUpdateCase,
  onNavigateToGraph,
}) => {
  const [newLabel, setNewLabel] = useState('');
  const [newNode, setNewNode] = useState('entry_method');
  const [newPresentState, setNewPresentState] = useState('F');
  const [newAbsentState, setNewAbsentState] = useState('N');

  // Compute conflicts locally in real time so investigator sees conflicts immediately
  const liveConflicts = useMemo<EvidenceConflict[]>(() => {
    const conflicts: EvidenceConflict[] = [];
    const byNode: Record<string, Array<{ state: string; obsLabel: string; status: string }>> = {};

    for (const obs of caseData.observations || []) {
      if (obs.status === 'Unknown' || !obs.mapped_node) continue;
      const st = obs.status === 'Present' ? obs.present_state : obs.absent_state;
      if (st) {
        byNode[obs.mapped_node] = byNode[obs.mapped_node] || [];
        byNode[obs.mapped_node].push({
          state: st,
          obsLabel: obs.label,
          status: obs.status,
        });
      }
    }

    for (const [nodeId, list] of Object.entries(byNode)) {
      const unique = new Set(list.map((x) => x.state));
      if (unique.size > 1) {
        const nMeta = graph.nodes.find((n) => n.id === nodeId);
        const friendly = nMeta?.friendly_name || nodeId;
        const summary = list
          .map((x) => {
            const stLabel =
              nMeta?.states.find((s) => s.state === x.state)?.label || x.state;
            return `"${x.obsLabel}" (${x.status}) → ${stLabel} [${x.state}]`;
          })
          .join(' vs. ');
        conflicts.push({
          id: `conf-${nodeId}`,
          severity: 'high',
          node: nodeId,
          friendly_name: friendly,
          title: `Conflicting Evidence on ${friendly}`,
          description: `Contradictory states asserted for ${friendly}: ${summary}. Resolve before trusting single-path inference.`,
        });
      }
    }

    return conflicts;
  }, [caseData.observations, graph.nodes]);

  const syncObservationsToGraph = (observations: ObservationItem[]) => {
    const nextEv = { ...caseData.manual_evidence };
    for (const obs of observations) {
      if (!obs.mapped_node) continue;
      if (obs.status === 'Present' && obs.present_state) {
        nextEv[obs.mapped_node] = obs.present_state;
      } else if (obs.status === 'Absent' && obs.absent_state) {
        nextEv[obs.mapped_node] = obs.absent_state;
      }
    }
    onUpdateCase(
      { observations, manual_evidence: nextEv },
      nextEv
    );
  };

  const handleStatusToggle = (
    obsId: string,
    status: 'Present' | 'Absent' | 'Unknown'
  ) => {
    const next = caseData.observations.map((o) =>
      o.id === obsId ? { ...o, status } : o
    );
    syncObservationsToGraph(next);
  };

  const handleAddObservation = () => {
    if (!newLabel.trim()) return;
    const item: ObservationItem = {
      id: `obs-${Date.now()}`,
      label: newLabel.trim(),
      category: 'Physical / Scene Review',
      status: 'Present',
      mapped_node: newNode,
      present_state: newPresentState,
      absent_state: newAbsentState || undefined,
      source_type: 'Investigator-entered',
      notes: '',
    };
    const next = [...caseData.observations, item];
    setNewLabel('');
    syncObservationsToGraph(next);
  };

  const selectedNodeMeta = graph.nodes.find((n) => n.id === newNode);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Step 4: Evidence Review & Conflict Detection
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mark each forensic observation as Present, Absent, or Unknown, convert reviewed findings into Bayesian Network evidence, and inspect any contradictions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            syncObservationsToGraph(caseData.observations);
            onNavigateToGraph();
          }}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg shadow-blue-600/25 cursor-pointer"
        >
          <ArrowRightCircle className="w-4 h-4" />
          Apply to Graph & Open Reconstruction
        </button>
      </div>

      {/* Conflict Warning Banner (Required by CORE FEATURE 5.4) */}
      {liveConflicts.length > 0 ? (
        <div
          data-testid="evidence-conflict-banner"
          className="p-4 rounded-2xl bg-rose-950/70 border-2 border-rose-500/80 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>
              Conflicting Evidence Flagged ({liveConflicts.length} Contradiction
              {liveConflicts.length > 1 ? 's' : ''})
            </span>
          </div>
          <div className="space-y-2">
            {liveConflicts.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-slate-950/80 border border-rose-700/60 text-xs text-rose-100"
              >
                <div className="font-bold text-rose-300">{c.title}</div>
                <p className="mt-0.5 text-slate-200">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-700/50 flex items-center gap-2 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            No conflicting evidence detected across reviewed observations.
          </span>
        </div>
      )}

      {/* Reviewed Observations List */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-100">
          Forensic Observations Checklist ({caseData.observations.length})
        </h3>

        <div className="space-y-3">
          {caseData.observations.map((obs) => {
            const nMeta = graph.nodes.find((n) => n.id === obs.mapped_node);
            const presentLabel =
              nMeta?.states.find((s) => s.state === obs.present_state)?.label ||
              obs.present_state;
            const absentLabel = obs.absent_state
              ? nMeta?.states.find((s) => s.state === obs.absent_state)?.label ||
                obs.absent_state
              : 'Unset';

            return (
              <div
                key={obs.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100">
                      {obs.label}
                    </span>
                    <SourceBadge type={obs.source_type} />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Maps to BN Node:{' '}
                    <strong className="text-blue-300">
                      {nMeta?.friendly_name || obs.mapped_node}
                    </strong>{' '}
                    | If Present → <code>{presentLabel}</code> | If Absent →{' '}
                    <code>{absentLabel}</code>
                  </div>
                  {obs.notes && (
                    <div className="text-[11px] text-slate-500 italic">
                      Note: {obs.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
                    {(['Present', 'Absent', 'Unknown'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusToggle(obs.id, st)}
                        className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                          obs.status === st
                            ? st === 'Present'
                              ? 'bg-emerald-600 text-white'
                              : st === 'Absent'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = caseData.observations.filter(
                        (o) => o.id !== obs.id
                      );
                      syncObservationsToGraph(next);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Custom Observation Row */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="text-xs font-bold text-slate-300">
            Add New Observation Mapping
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <div className="md:col-span-4">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Observation description (e.g., Pry marks on lock)"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
              />
            </div>
            <div className="md:col-span-3">
              <select
                value={newNode}
                onChange={(e) => {
                  const nid = e.target.value;
                  setNewNode(nid);
                  const m = graph.nodes.find((n) => n.id === nid);
                  if (m && m.states.length > 0) {
                    setNewPresentState(m.states[0].state);
                    setNewAbsentState(m.states[1]?.state || '');
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
              >
                {graph.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    Node: {n.friendly_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <select
                value={newPresentState}
                onChange={(e) => setNewPresentState(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
              >
                {selectedNodeMeta?.states.map((st) => (
                  <option key={st.state} value={st.state}>
                    If Present → {st.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleAddObservation}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
