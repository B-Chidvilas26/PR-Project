import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Plus, Trash2, Play, Sparkles, CheckCircle2, Scale } from 'lucide-react';
import {
  GraphResponse,
  ScenarioCompareResponse,
  PresetScenario,
} from '../types';
import { api } from '../api';
import { SourceBadge } from './SourceBadge';

interface ScenarioDraft {
  id: string;
  name: string;
  evidence: Record<string, string>;
}

interface ScenarioComparisonViewProps {
  graph: GraphResponse;
  currentCaseEvidence: Record<string, string>;
  presets: PresetScenario[];
  initialScenarios?: Array<{ name: string; evidence: Record<string, string> }>;
  onApplyScenarioToGraph?: (evidence: Record<string, string>, queryVar: string) => void;
}

const SCENARIO_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];

export const ScenarioComparisonView: React.FC<ScenarioComparisonViewProps> = ({
  graph,
  currentCaseEvidence,
  presets,
  initialScenarios,
  onApplyScenarioToGraph,
}) => {
  const [queryVar, setQueryVar] = useState<string>('attempt_completed');
  const [scenarios, setScenarios] = useState<ScenarioDraft[]>(() => {
    if (initialScenarios && initialScenarios.length >= 2) {
      return initialScenarios.slice(0, 4).map((s, idx) => ({
        id: `scen-${idx + 1}`,
        name: s.name,
        evidence: { ...s.evidence },
      }));
    }
    return [
      {
        id: 'scen-1',
        name: 'Scenario A: Night + Forced Entry',
        evidence: { time_period: 'Night', entry_method: 'F' },
      },
      {
        id: 'scen-2',
        name: 'Scenario B: Afternoon + Non-Forced Entry',
        evidence: { time_period: 'Afternoon', entry_method: 'N' },
      },
      {
        id: 'scen-3',
        name: 'Scenario C: Current Case Evidence',
        evidence:
          Object.keys(currentCaseEvidence).length > 0
            ? { ...currentCaseEvidence }
            : { time_period: 'Evening', location: '35', entry_method: 'F' },
      },
    ];
  });

  const [comparison, setComparison] = useState<ScenarioCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-scenario new evidence adder state
  const [newNodeByScen, setNewNodeByScen] = useState<Record<string, string>>({});

  const runComparison = async (drafts = scenarios, q = queryVar) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.compareScenarios({
        scenarios: drafts.map((d) => ({ name: d.name, evidence: d.evidence })),
        query_var: q,
      });
      setComparison(res);
    } catch (err: any) {
      setError(err.message || 'Failed to compare scenarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runComparison(scenarios, queryVar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryVar]);

  useEffect(() => {
    if (initialScenarios && initialScenarios.length >= 2) {
      const mapped = initialScenarios.slice(0, 4).map((s, i) => ({
        id: `span-${i + 1}`,
        name: s.name,
        evidence: { ...s.evidence },
      }));
      setScenarios(mapped);
      runComparison(mapped, queryVar);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScenarios]);

  const handleAddScenario = () => {
    if (scenarios.length >= 4) return;
    const nextIdx = scenarios.length + 1;
    const next = [
      ...scenarios,
      {
        id: `scen-${Date.now()}`,
        name: `Scenario ${String.fromCharCode(64 + nextIdx)}: Custom Hypothesis`,
        evidence: { ...currentCaseEvidence },
      },
    ];
    setScenarios(next);
    runComparison(next, queryVar);
  };

  const handleRemoveScenario = (id: string) => {
    if (scenarios.length <= 2) return;
    const next = scenarios.filter((s) => s.id !== id);
    setScenarios(next);
    runComparison(next, queryVar);
  };

  const handleUpdateEvidence = (scenId: string, node: string, stateVal: string | null) => {
    const next = scenarios.map((s) => {
      if (s.id !== scenId) return s;
      const ev = { ...s.evidence };
      if (!stateVal) {
        delete ev[node];
      } else {
        ev[node] = stateVal;
      }
      return { ...s, evidence: ev };
    });
    setScenarios(next);
    runComparison(next, queryVar);
  };

  // Prepare side-by-side chart data
  const chartData = React.useMemo(() => {
    if (!comparison || comparison.scenarios.length === 0) return [];
    const firstStates = comparison.scenarios[0].states;
    return firstStates.slice(0, 8).map((st) => {
      const row: Record<string, any> = {
        stateLabel: st.label,
        Prior: Number((st.prior * 100).toFixed(2)),
      };
      comparison.scenarios.forEach((scen) => {
        const match = scen.states.find((x) => x.state === st.state);
        row[scen.name] = Number(((match?.posterior ?? 0) * 100).toFixed(2));
      });
      return row;
    });
  }, [comparison]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Multi-Scenario Hypothesis Comparison (2–4 Candidate Scenarios)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compare competing investigative hypotheses side-by-side using exact Variable Elimination on the learned Bayesian Network.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-300 font-semibold">Query Variable:</span>
            <select
              aria-label="Comparison Query Variable"
              value={queryVar}
              onChange={(e) => setQueryVar(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-purple-500/60 text-purple-200 text-xs font-medium"
            >
              {graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.friendly_name}
                </option>
              ))}
            </select>
          </div>

          {scenarios.length < 4 && (
            <button
              onClick={handleAddScenario}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Scenario ({scenarios.length}/4)
            </button>
          )}

          <button
            onClick={() => runComparison(scenarios, queryVar)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {loading ? 'Comparing...' : 'Recompute Comparison'}
          </button>
        </div>
      </div>

      {/* Quick Preset Comparison Loader */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">Load Preset Pairs:</span>
        <button
          onClick={() => {
            const pair: ScenarioDraft[] = [
              {
                id: 'p1',
                name: 'Scenario 1: Night + Forced Entry',
                evidence: { time_period: 'Night', entry_method: 'F' },
              },
              {
                id: 'p2',
                name: 'Scenario 2: Afternoon + Non-Forced Entry',
                evidence: { time_period: 'Afternoon', entry_method: 'N' },
              },
            ];
            setQueryVar('attempt_completed');
            setScenarios(pair);
            runComparison(pair, 'attempt_completed');
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
        >
          Night+Forced vs. Afternoon+Non-Forced (Completion)
        </button>
        <button
          onClick={() => {
            const pair: ScenarioDraft[] = [
              {
                id: 'p3',
                name: 'Forced + Completed Burglary',
                evidence: { entry_method: 'F', attempt_completed: 'C' },
              },
              {
                id: 'p4',
                name: 'Non-Forced + Attempted Burglary',
                evidence: { entry_method: 'N', attempt_completed: 'A' },
              },
            ];
            setQueryVar('property_loss');
            setScenarios(pair);
            runComparison(pair, 'property_loss');
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
        >
          Forced+Completed vs. Non-Forced+Attempted (Property Loss)
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-700 text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Plain-English Fit & Uncertainty Summary Box */}
      {comparison && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-purple-950/50 border border-blue-700/40 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-300">
              <Sparkles className="w-4 h-4" />
              Plain-English Scenario Fit & Posterior Assessment
            </div>
            <SourceBadge type="Model estimate" />
          </div>
          <ul className="space-y-1 text-xs text-slate-200 leading-relaxed">
            {comparison.summary_points.map((pt, idx) => (
              <li key={idx}>{pt}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-Side Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {scenarios.map((draft, idx) => {
          const evalScen = comparison?.scenarios[idx];
          const color = SCENARIO_COLORS[idx % SCENARIO_COLORS.length];
          const selectedNewNode = newNodeByScen[draft.id] || 'location';
          const nodeMetaForAdd = graph.nodes.find((n) => n.id === selectedNewNode);

          return (
            <div
              key={draft.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between overflow-hidden shadow-lg"
            >
              <div>
                {/* Card Header */}
                <div
                  className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2"
                  style={{ borderTop: `3px solid ${color}` }}
                >
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => {
                      const next = scenarios.map((s) =>
                        s.id === draft.id ? { ...s, name: e.target.value } : s
                      );
                      setScenarios(next);
                    }}
                    onBlur={() => runComparison(scenarios, queryVar)}
                    className="bg-transparent font-bold text-sm text-slate-100 focus:outline-none focus:border-b focus:border-blue-400 flex-1"
                  />
                  {scenarios.length > 2 && (
                    <button
                      onClick={() => handleRemoveScenario(draft.id)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="Remove scenario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Evidence Items in Scenario */}
                <div className="p-4 space-y-3 border-b border-slate-800/80">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Scenario Evidence ({Object.keys(draft.evidence).length} Clamped)
                  </div>

                  <div className="space-y-1.5">
                    {Object.entries(draft.evidence).map(([nodeKey, stVal]) => {
                      const nMeta = graph.nodes.find((n) => n.id === nodeKey);
                      return (
                        <div
                          key={nodeKey}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                        >
                          <span className="text-slate-300 font-medium truncate">
                            {nMeta?.friendly_name || nodeKey}:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={stVal}
                              onChange={(e) =>
                                handleUpdateEvidence(draft.id, nodeKey, e.target.value)
                              }
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-blue-200 max-w-[140px]"
                            >
                              {nMeta?.states.map((st) => (
                                <option key={st.state} value={st.state}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleUpdateEvidence(draft.id, nodeKey, null)}
                              className="text-slate-500 hover:text-rose-400"
                              title="Remove evidence variable"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Evidence Variable Row */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <select
                      value={selectedNewNode}
                      onChange={(e) =>
                        setNewNodeByScen({ ...newNodeByScen, [draft.id]: e.target.value })
                      }
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300"
                    >
                      {graph.nodes
                        .filter((n) => !(n.id in draft.evidence))
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            + {n.friendly_name}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => {
                        if (nodeMetaForAdd && nodeMetaForAdd.states.length > 0) {
                          handleUpdateEvidence(
                            draft.id,
                            nodeMetaForAdd.id,
                            nodeMetaForAdd.states[0].state
                          );
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-blue-300 font-medium cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Evaluated Posterior Results */}
                {evalScen && (
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Most Probable Outcome:</span>
                      <span className="font-bold text-emerald-300">
                        {evalScen.top_state.label} (
                        {(evalScen.top_state.posterior * 100).toFixed(2)}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Posterior Uncertainty:</span>
                      <span className="font-mono text-slate-200">
                        {evalScen.entropy.uncertainty_level} (H ={' '}
                        {evalScen.entropy.entropy_bits.toFixed(2)} bits)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Historical Evidence Frequency P(E):</span>
                      <span className="font-mono text-slate-300">
                        {(evalScen.evidence_prior_prob * 100).toFixed(2)}%
                      </span>
                    </div>

                    <div className="pt-2 space-y-1.5">
                      {evalScen.states.slice(0, 4).map((st) => (
                        <div key={st.state} className="space-y-0.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-300 truncate">{st.label}</span>
                            <span className="font-mono font-bold text-slate-100">
                              {(st.posterior * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, st.posterior * 100)}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {onApplyScenarioToGraph && (
                <div className="p-3 bg-slate-950/60 border-t border-slate-800">
                  <button
                    onClick={() => onApplyScenarioToGraph(draft.evidence, queryVar)}
                    className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-blue-900/60 border border-slate-700 text-xs font-medium text-blue-300 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Apply Scenario to Live Graph
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grouped Bar Chart Comparing Posteriors Across Scenarios */}
      {comparison && chartData.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-slate-200">
            Side-by-Side Posterior Comparison: {comparison.query_friendly_name}
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="stateLabel" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  unit="%"
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Bar dataKey="Prior" fill="#475569" radius={[4, 4, 0, 0]} />
                {comparison.scenarios.map((scen, idx) => (
                  <Bar
                    key={scen.name}
                    dataKey={scen.name}
                    fill={SCENARIO_COLORS[idx % SCENARIO_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
