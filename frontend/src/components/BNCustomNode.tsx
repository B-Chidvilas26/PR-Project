import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle2, HelpCircle, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { GraphNodeMeta, NodeInferenceResult } from '../types';

export interface BNCustomNodeData {
  meta: GraphNodeMeta;
  inference?: NodeInferenceResult;
  evidenceValue?: string;
  isSelected?: boolean;
  isQueryTarget?: boolean;
  highlightRole?: 'self' | 'parent' | 'child' | 'spouse' | 'dimmed' | null;
  showTechnicalNames?: boolean;
  layoutDirection?: 'LR' | 'TB';
  onNodeHover?: (nodeId: string | null) => void;
  [key: string]: unknown;
}

export const BNCustomNode: React.FC<{ data: BNCustomNodeData }> = ({ data }) => {
  const {
    meta,
    inference,
    evidenceValue,
    isSelected,
    isQueryTarget,
    highlightRole,
    showTechnicalNames,
    layoutDirection = 'LR',
    onNodeHover,
  } = data;

  const isEvidence = Boolean(evidenceValue);
  const isUnknownEvidence = evidenceValue === 'Unknown' || evidenceValue === 'U';

  // Sort states by posterior (or prior if inference not loaded yet) to show top 2 in mini bar
  const rawStates = inference?.states || meta.states;
  const sortedStates = [...rawStates].sort(
    (a, b) => (b.posterior ?? b.prior) - (a.posterior ?? a.prior)
  );
  const topStates = sortedStates.slice(0, 2);
  const topState = sortedStates[0];

  const entropyLevel = inference?.entropy?.uncertainty_level || meta.prior_entropy.uncertainty_level;

  let ringClass = 'border-slate-700/90 hover:border-slate-500';
  if (isSelected) {
    ringClass = 'border-blue-400 ring-2 ring-blue-500/50 shadow-blue-500/20';
  } else if (highlightRole === 'parent') {
    ringClass = 'border-sky-400 ring-2 ring-sky-400/50';
  } else if (highlightRole === 'child') {
    ringClass = 'border-emerald-400 ring-2 ring-emerald-400/50';
  } else if (highlightRole === 'spouse') {
    ringClass = 'border-amber-400 ring-2 ring-amber-400/50';
  } else if (isEvidence) {
    ringClass = isUnknownEvidence
      ? 'border-amber-500/90 ring-1 ring-amber-500/30'
      : 'border-blue-500/90 ring-1 ring-blue-500/40';
  } else if (isQueryTarget) {
    ringClass = 'border-purple-400/90 ring-1 ring-purple-500/40';
  }

  const opacityClass = highlightRole === 'dimmed' ? 'opacity-35' : 'opacity-100';

  const sourcePos = layoutDirection === 'LR' ? Position.Right : Position.Bottom;
  const targetPos = layoutDirection === 'LR' ? Position.Left : Position.Top;

  return (
    <div
      data-testid={`bn-node-${meta.id}`}
      onMouseEnter={() => onNodeHover && onNodeHover(meta.id)}
      onMouseLeave={() => onNodeHover && onNodeHover(null)}
      className={`w-[235px] rounded-xl bg-slate-900/95 backdrop-blur border-2 shadow-xl transition-all duration-150 select-none ${ringClass} ${opacityClass}`}
    >
      <Handle
        type="target"
        position={targetPos}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-slate-900"
      />

      {/* Group Header Bar */}
      <div
        className="px-3 py-1.5 rounded-t-[10px] flex items-center justify-between border-b border-slate-800"
        style={{ backgroundColor: `${meta.color}22` }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
            {meta.group}
          </span>
        </div>

        {/* Role / Evidence / Query Chip */}
        {highlightRole === 'parent' && (
          <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[9px] font-bold">
            PARENT
          </span>
        )}
        {highlightRole === 'child' && (
          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
            CHILD
          </span>
        )}
        {highlightRole === 'spouse' && (
          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
            MARKOV SPOUSE
          </span>
        )}
        {!highlightRole && isEvidence && (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
              isUnknownEvidence
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-blue-500/25 text-blue-200 border border-blue-400/50'
            }`}
          >
            {isUnknownEvidence ? (
              <>
                <HelpCircle className="w-2.5 h-2.5" /> UNKNOWN
              </>
            ) : (
              <>
                <CheckCircle2 className="w-2.5 h-2.5" /> EVIDENCE
              </>
            )}
          </span>
        )}
        {!highlightRole && !isEvidence && isQueryTarget && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-200 border border-purple-400/40 text-[9px] font-bold">
            <Sparkles className="w-2.5 h-2.5" /> QUERY
          </span>
        )}
      </div>

      {/* Node Title */}
      <div className="px-3 pt-2 pb-1">
        <div className="text-xs font-bold text-slate-100 leading-snug truncate">
          {meta.friendly_name}
        </div>
        {showTechnicalNames && (
          <div className="text-[10px] font-mono text-slate-400 truncate">{meta.id}</div>
        )}
      </div>

      {/* Body: Either Clamped Evidence Badge OR Mini Posterior Probability Bars */}
      <div className="px-3 pb-2.5 pt-1 space-y-1.5">
        {isEvidence ? (
          <div
            className={`p-2 rounded-lg border text-xs ${
              isUnknownEvidence
                ? 'bg-amber-950/40 border-amber-700/50 text-amber-200'
                : 'bg-blue-950/50 border-blue-700/60 text-blue-100'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-75">
              Observed State (100%)
            </div>
            <div className="font-semibold truncate mt-0.5" title={inference?.evidence_label || evidenceValue}>
              {inference?.evidence_label ||
                meta.states.find((s) => s.state === evidenceValue)?.label ||
                evidenceValue}
            </div>
          </div>
        ) : (
          <>
            {topStates.map((st) => {
              const prob = st.posterior ?? st.prior;
              const pct = (prob * 100).toFixed(1);
              const delta = st.delta ?? 0;
              return (
                <div key={st.state} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span
                      className="text-slate-300 truncate max-w-[130px]"
                      title={st.tooltip}
                    >
                      {st.label}
                    </span>
                    <div className="flex items-center gap-1 font-mono">
                      <span className="font-semibold text-slate-100">{pct}%</span>
                      {Math.abs(delta) >= 0.002 && (
                        <span
                          className={`inline-flex items-center text-[9px] font-bold ${
                            delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                          title={`Change vs. prior: ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`}
                        >
                          {delta > 0 ? (
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          ) : (
                            <ArrowDownRight className="w-2.5 h-2.5" />
                          )}
                          {delta > 0 ? '+' : ''}
                          {(delta * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(2, Math.min(100, prob * 100))}%`,
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Uncertainty footer */}
            <div className="pt-1 flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-800/80">
              <span>
                Uncertainty:{' '}
                <strong
                  className={
                    entropyLevel === 'Low'
                      ? 'text-emerald-400'
                      : entropyLevel === 'Medium'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {entropyLevel}
                </strong>
              </span>
              {topState && (
                <span className="font-mono text-slate-500">
                  H={(inference?.entropy?.entropy_bits ?? meta.prior_entropy.entropy_bits).toFixed(2)}b
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <Handle
        type="source"
        position={sourcePos}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-slate-900"
      />
    </div>
  );
};
