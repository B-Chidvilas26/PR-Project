import React from 'react';
import { Moon, Sun, Sunset, Lock, Unlock, Home, Building2, UserX, Users2, RotateCcw, Zap } from 'lucide-react';

interface RapidWhatIfChipsProps {
  evidence: Record<string, string>;
  onToggleEvidence: (nodeId: string, value: string) => void;
  onClearAll: () => void;
}

interface ChipDef {
  nodeId: string;
  value: string;
  label: string;
  icon: React.ReactNode;
  category: string;
}

export const RapidWhatIfChips: React.FC<RapidWhatIfChipsProps> = ({
  evidence,
  onToggleEvidence,
  onClearAll,
}) => {
  const chips: ChipDef[] = [
    {
      category: 'Time',
      nodeId: 'time_period',
      value: 'Night',
      label: 'Night (00–05)',
      icon: <Moon className="w-3 h-3" />,
    },
    {
      category: 'Time',
      nodeId: 'time_period',
      value: 'Evening',
      label: 'Evening (18–23)',
      icon: <Sunset className="w-3 h-3" />,
    },
    {
      category: 'Time',
      nodeId: 'time_period',
      value: 'Afternoon',
      label: 'Afternoon (12–17)',
      icon: <Sun className="w-3 h-3" />,
    },
    {
      category: 'Entry',
      nodeId: 'entry_method',
      value: 'F',
      label: 'Forced Entry',
      icon: <Lock className="w-3 h-3 text-red-400" />,
    },
    {
      category: 'Entry',
      nodeId: 'entry_method',
      value: 'N',
      label: 'No Force (Open)',
      icon: <Unlock className="w-3 h-3 text-amber-400" />,
    },
    {
      category: 'Scene',
      nodeId: 'location',
      value: '35',
      label: 'Residence',
      icon: <Home className="w-3 h-3 text-sky-400" />,
    },
    {
      category: 'Scene',
      nodeId: 'location',
      value: '05',
      label: 'Commercial Store',
      icon: <Building2 className="w-3 h-3 text-orange-400" />,
    },
    {
      category: 'Suspect',
      nodeId: 'relationship',
      value: '28.0',
      label: 'Stranger',
      icon: <UserX className="w-3 h-3 text-purple-400" />,
    },
    {
      category: 'Suspect',
      nodeId: 'relationship',
      value: '24.0',
      label: 'Acquaintance',
      icon: <Users2 className="w-3 h-3 text-indigo-400" />,
    },
  ];

  const activeCount = Object.keys(evidence).length;

  return (
    <div
      data-testid="rapid-what-if-chips"
      className="px-4 py-2 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 uppercase tracking-wider mr-1 shrink-0">
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" /> What-If Clues:
        </span>

        {chips.map((chip) => {
          const isActive = evidence[chip.nodeId] === chip.value;
          return (
            <button
              key={`${chip.nodeId}-${chip.value}`}
              onClick={() => onToggleEvidence(chip.nodeId, chip.value)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer select-none border shrink-0 ${
                isActive
                  ? 'bg-emerald-600/25 border-emerald-400/80 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/40'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-slate-100 hover:bg-slate-900'
              }`}
              title={`Click to test ${chip.label}`}
            >
              {chip.icon}
              <span>{chip.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Clear Clues Action */}
      <div className="flex items-center gap-2 shrink-0">
        {activeCount > 0 && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-[11px] font-semibold transition cursor-pointer"
            title="Clear all active evidence from Bayesian Network"
          >
            <RotateCcw className="w-3 h-3" /> Reset Clues ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
};
