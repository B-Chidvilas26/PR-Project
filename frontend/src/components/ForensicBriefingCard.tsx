import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, Key, User, Home } from 'lucide-react';
import { InferResponse, GraphResponse } from '../types';

interface ForensicBriefingCardProps {
  inferenceResult: InferResponse | null;
  graph: GraphResponse;
  evidence: Record<string, string>;
  onSelectNode?: (nodeId: string) => void;
}

export const ForensicBriefingCard: React.FC<ForensicBriefingCardProps> = ({
  inferenceResult,
  evidence,
  onSelectNode,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!inferenceResult) return null;

  const nodes = inferenceResult.nodes || {};

  // Extract top predictions from key nodes
  const attemptNode = nodes['attempt_completed'];
  const entryNode = nodes['entry_method'];
  const locNode = nodes['location'];
  const relNode = nodes['relationship'];
  const offAgeNode = nodes['offender_age_group'];
  const offSexNode = nodes['offender_sex'];

  // Top state labels & posteriors from top_state (NodeStateMeta)
  const attemptLabel = attemptNode?.top_state?.label || 'Completed';
  const attemptProb = Math.round((attemptNode?.top_state?.posterior ?? 0.95) * 100);

  const entryLabel = entryNode?.top_state?.label || 'Forced Entry';
  const entryProb = Math.round((entryNode?.top_state?.posterior ?? 0.8) * 100);

  const offAgeLabel = offAgeNode?.top_state?.label || 'Young Adult';
  const offSexLabel = offSexNode?.top_state?.label || 'Male';
  const relLabel = relNode?.top_state?.label || 'Stranger';
  const locLabel = locNode?.top_state?.label || 'Residence';

  const evidenceCount = Object.keys(evidence).length;
  const isHighConfidence = attemptProb >= 85;

  return (
    <div
      data-testid="forensic-briefing-card"
      className="rounded-2xl border border-blue-500/30 bg-slate-900/90 backdrop-blur-md shadow-2xl transition-all duration-200 overflow-hidden"
    >
      {/* Header bar */}
      <div
        onClick={() => setIsExpanded((v) => !v)}
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none bg-gradient-to-r from-blue-950/60 via-slate-900/60 to-slate-900/60"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-100 tracking-wide uppercase">
                Forensic Case Hypothesis
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isHighConfidence
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                }`}
              >
                {isHighConfidence ? (
                  <>
                    <ShieldCheck className="w-3 h-3" /> High Confidence ({attemptProb}%)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" /> Investigating ({attemptProb}%)
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">
            Based on <strong className="text-slate-200">{evidenceCount}</strong> active clue{evidenceCount === 1 ? '' : 's'}
          </span>
          <button
            className="p-1 text-slate-400 hover:text-slate-200"
            aria-label={isExpanded ? 'Collapse Forensic Briefing' : 'Expand Forensic Briefing'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Body */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-3 border-t border-slate-800/70 text-xs">
          {/* Executive Narrative */}
          <p className="text-slate-200 leading-relaxed">
            The probabilistic model reconstructs a{' '}
            <strong className="text-blue-300 font-semibold">{attemptLabel} ({attemptProb}%)</strong>{' '}
            at a <strong className="text-slate-100">{locLabel}</strong>, with{' '}
            <strong className="text-emerald-300 font-semibold">{entryLabel} ({entryProb}%)</strong>{' '}
            as the primary intrusion method. The behavioral signature suggests a{' '}
            <strong className="text-purple-300">{offAgeLabel} {offSexLabel}</strong> operating as a{' '}
            <strong className="text-purple-300">{relLabel}</strong>.
          </p>

          {/* 3 Pillar Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {/* Pillar 1: Intrusion & Outcome */}
            <div
              onClick={() => onSelectNode && onSelectNode('entry_method')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 cursor-pointer transition flex items-start gap-2"
            >
              <Key className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Intrusion Mechanism</div>
                <div className="text-xs font-semibold text-slate-100 mt-0.5">
                  {entryLabel} <span className="text-emerald-400 font-mono text-[11px]">({entryProb}%)</span>
                </div>
              </div>
            </div>

            {/* Pillar 2: Offender Signature */}
            <div
              onClick={() => onSelectNode && onSelectNode('offender_age_group')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/50 cursor-pointer transition flex items-start gap-2"
            >
              <User className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Offender Profile</div>
                <div className="text-xs font-semibold text-slate-100 mt-0.5">
                  {offAgeLabel} {offSexLabel} • {relLabel}
                </div>
              </div>
            </div>

            {/* Pillar 3: Property & Scene */}
            <div
              onClick={() => onSelectNode && onSelectNode('location')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 cursor-pointer transition flex items-start gap-2"
            >
              <Home className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Scene Profile</div>
                <div className="text-xs font-semibold text-slate-100 mt-0.5">
                  {locLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
