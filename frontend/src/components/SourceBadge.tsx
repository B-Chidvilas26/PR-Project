import React from 'react';

export type ProvenanceType =
  | 'Investigator-entered'
  | 'Uploaded evidence'
  | 'Model estimate'
  | 'Missing/Unknown';

interface SourceBadgeProps {
  type: ProvenanceType;
  className?: string;
}

const BADGE_STYLES: Record<ProvenanceType, string> = {
  'Investigator-entered':
    'bg-blue-950/90 text-blue-300 border-blue-700/80',
  'Uploaded evidence':
    'bg-emerald-950/90 text-emerald-300 border-emerald-700/80',
  'Model estimate':
    'bg-purple-950/90 text-purple-300 border-purple-700/80',
  'Missing/Unknown':
    'bg-amber-950/90 text-amber-300 border-amber-700/80',
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({ type, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border ${BADGE_STYLES[type]} ${className}`}
    >
      {type}
    </span>
  );
};
