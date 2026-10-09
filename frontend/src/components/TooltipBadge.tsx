import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { GLOSSARY_TOOLTIPS } from '../utils/tooltips';

interface TooltipBadgeProps {
  termKey: keyof typeof GLOSSARY_TOOLTIPS;
  label?: string;
}

export const TooltipBadge: React.FC<TooltipBadgeProps> = ({ termKey, label }) => {
  const [open, setOpen] = useState(false);
  const item = GLOSSARY_TOOLTIPS[termKey];
  if (!item) return null;

  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 px-2 py-0.5 rounded-full transition"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      title={`${item.title}: ${item.text}`}
    >
      <span>{label || item.title}</span>
      <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-lg bg-slate-900 border border-slate-600 shadow-2xl text-left z-50 pointer-events-none"
        >
          <div className="font-semibold text-blue-300 text-xs mb-1">{item.title}</div>
          <div className="text-[11px] leading-relaxed text-slate-200 font-normal">
            {item.text}
          </div>
        </div>
      )}
    </span>
  );
};
