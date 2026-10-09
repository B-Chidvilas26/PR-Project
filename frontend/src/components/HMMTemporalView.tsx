import React, { useEffect, useState } from 'react';
import { Activity, Info, Calendar, Clock, ArrowRight } from 'lucide-react';
import { HMMOverviewResponse, HMMEstimateResponse } from '../types';
import { api } from '../api';
import { TooltipBadge } from './TooltipBadge';
import { SourceBadge } from './SourceBadge';

interface HMMTemporalViewProps {
  caseMonth?: number;
  caseTimePeriod?: string;
}

export const HMMTemporalView: React.FC<HMMTemporalViewProps> = ({
  caseMonth = 10,
  caseTimePeriod = 'Night',
}) => {
  const [overview, setOverview] = useState<HMMOverviewResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(caseMonth || 10);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(caseTimePeriod || 'Night');
  const [cellEstimate, setCellEstimate] = useState<HMMEstimateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getHMM()
      .then((res) => setOverview(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (caseMonth && caseMonth >= 1 && caseMonth <= 12) {
      setSelectedMonth(caseMonth);
    }
    if (caseTimePeriod) {
      setSelectedPeriod(caseTimePeriod);
    }
  }, [caseMonth, caseTimePeriod]);

  useEffect(() => {
    api
      .estimateHMMCell(selectedMonth, selectedPeriod)
      .then((res) => setCellEstimate(res))
      .catch(console.error);
  }, [selectedMonth, selectedPeriod]);

  if (loading || !overview) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Loading Hidden Markov Model (burglary_hmm_model.pkl & burglary_hmm_states.csv)...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Scope Notice Banner (Required by CORE FEATURE 3) */}
      <div
        data-testid="hmm-scope-banner"
        className="p-4 rounded-2xl bg-amber-950/50 border border-amber-600/60 flex items-start gap-3"
      >
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Regional Temporal Activity Model — Scope & Interpretation Notice
          </div>
          <p className="text-xs text-amber-100/90 leading-relaxed">
            {overview.scope_notice} The model is trained on {overview.total_observations}{' '}
            aggregated (month × 6-hour period) burglary counts (overall mean ={' '}
            {overview.overall_mean_count} incidents, σ = {overview.overall_std_count}).
          </p>
        </div>
      </div>

      {/* Header + Tooltips */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Hidden Markov Model (HMM) — Regional Burglary Activity Regimes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            3 latent activity states across 12 calendar months and 4 six-hour periods.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipBadge termKey="hmm" />
          <TooltipBadge termKey="hidden_state" />
        </div>
      </div>

      {/* 3 Hidden States Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {overview.states.map((st) => (
          <div
            key={st.state}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2"
            style={{ borderTop: `3px solid ${st.color}` }}
          >
            <div className="flex items-center justify-between">
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: `${st.color}25`,
                  color: st.color,
                }}
              >
                State {st.state}: {st.name}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {st.observation_count}/48 periods ({(st.proportion * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {st.mean_crime_count.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-400">
                mean burglaries / period
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{st.description}</p>
          </div>
        ))}
      </div>

      {/* Case-Linked Cell Estimate Card */}
      {cellEstimate && (
        <div
          data-testid="hmm-case-estimate"
          className="p-5 rounded-2xl bg-slate-900 border border-blue-500/50 shadow-xl space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">
                Selected Case Window Estimate:
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-950 border border-blue-700 text-xs font-semibold text-blue-200 inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {cellEstimate.month_name} (Month{' '}
                {cellEstimate.month})
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-950 border border-blue-700 text-xs font-semibold text-blue-200 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {cellEstimate.time_period}
              </span>
              <SourceBadge type="Model estimate" />
            </div>

            {/* Interactive Month / Period Selector */}
            <div className="flex items-center gap-2 text-xs">
              <select
                aria-label="HMM Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200"
              >
                {overview.grid.map((m) => (
                  <option key={m.month} value={m.month}>
                    {m.month_name}
                  </option>
                ))}
              </select>
              <select
                aria-label="HMM Time Period"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200"
              >
                {overview.period_order.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="Unknown">Unknown Period</option>
              </select>
            </div>
          </div>

          {!cellEstimate.is_unknown_period ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">
                  Inferred Regional Activity State
                </div>
                <div
                  className="text-xl font-bold"
                  style={{ color: cellEstimate.color }}
                >
                  State {cellEstimate.hidden_state}: {cellEstimate.state_name}
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  Historical Period Count: <strong>{cellEstimate.crime_count}</strong>{' '}
                  burglaries (State Mean: {cellEstimate.state_mean})
                </div>
              </div>

              <div className="lg:col-span-8 space-y-2">
                <p className="text-xs text-slate-200 leading-relaxed">
                  {cellEstimate.explanation}
                </p>
                {cellEstimate.next_state_probabilities && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <span className="text-slate-400 inline-flex items-center gap-1">
                      <ArrowRight className="w-3.5 h-3.5" /> Next Window Transition Probabilities:
                    </span>
                    {cellEstimate.next_state_probabilities.map((np) => (
                      <span
                        key={np.state}
                        className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-slate-200"
                      >
                        {np.name}: <strong>{(np.probability * 100).toFixed(1)}%</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200">
              {cellEstimate.explanation}
            </div>
          )}
        </div>
      )}

      {/* Split Grid: 12x4 Month x Time-Period Grid + 3x3 Transition Matrix Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Month x Time-Period Grid */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">
              Month × Time-Period Activity Grid (burglary_hmm_states.csv)
            </h3>
            <span className="text-[11px] text-slate-400">
              Click any cell to inspect regional estimate
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3 text-left">Month</th>
                  {overview.period_order.map((period) => (
                    <th key={period} className="py-2 px-3 text-center">
                      {period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.grid.map((row) => (
                  <tr key={row.month} className="border-b border-slate-800/60">
                    <td className="py-2 px-3 font-semibold text-slate-200">
                      {row.month}. {row.month_name}
                    </td>
                    {overview.period_order.map((period) => {
                      const cell = row.periods[period];
                      if (!cell) return <td key={period} />;
                      const isSelected =
                        selectedMonth === row.month && selectedPeriod === period;
                      return (
                        <td key={period} className="p-1.5">
                          <button
                            onClick={() => {
                              setSelectedMonth(row.month);
                              setSelectedPeriod(period);
                            }}
                            className={`w-full py-2 px-2.5 rounded-lg border text-center transition cursor-pointer ${
                              isSelected
                                ? 'ring-2 ring-white border-white shadow-lg'
                                : 'border-slate-800/80 hover:border-slate-600'
                            }`}
                            style={{
                              backgroundColor: `${cell.color}22`,
                            }}
                          >
                            <div
                              className="text-[11px] font-bold uppercase tracking-wider"
                              style={{ color: cell.color }}
                            >
                              {cell.state_short} (S{cell.hidden_state})
                            </div>
                            <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                              {cell.crime_count} crimes
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transition Matrix Heatmap */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-100">
              State Transition Matrix Heatmap P(S_t+1 | S_t)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Learned transition probabilities between consecutive 6-hour activity states in{' '}
              <code>burglary_hmm_model.pkl</code>.
            </p>

            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-400 text-[11px]">
                      From \ To
                    </th>
                    {overview.states.map((s) => (
                      <th key={s.state} className="p-2 text-center text-slate-300">
                        S{s.state} ({s.short})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.transition_rows.map((tr) => (
                    <tr key={tr.from_state}>
                      <td className="p-2 font-semibold text-slate-300 text-[11px]">
                        S{tr.from_state} ({overview.states[tr.from_state].short})
                      </td>
                      {tr.transitions.map((cell) => {
                        const intensity = Math.max(0.12, cell.probability);
                        return (
                          <td key={cell.to_state} className="p-1.5">
                            <div
                              className="p-3 rounded-xl border border-blue-500/30 text-center font-mono"
                              style={{
                                backgroundColor: `rgba(59, 130, 246, ${intensity * 0.85})`,
                              }}
                            >
                              <div className="text-sm font-bold text-white">
                                {(cell.probability * 100).toFixed(1)}%
                              </div>
                              <div className="text-[10px] text-blue-100/80">
                                {cell.probability.toFixed(4)}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
            <div className="font-bold text-slate-300">
              Key Transition Patterns (from hmm_inference.py.py):
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              • <strong>Low Activity (S0)</strong> transitions to Medium Activity (S1) 60.0% of the time.
              <br />• <strong>Medium Activity (S1)</strong> transitions to High Activity (S2) 50.0% of the time.
              <br />• <strong>High Activity (S2)</strong> persists in Medium/High 62.5% of the time or resets to Morning Low (37.5%).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
