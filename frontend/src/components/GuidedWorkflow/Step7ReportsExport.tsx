import React, { useEffect, useState } from 'react';
import { FileDown, Printer, ShieldAlert, CheckCircle2, FileJson } from 'lucide-react';
import { CaseRecord, GraphResponse, InferResponse } from '../../types';
import { api } from '../../api';
import { SourceBadge } from '../SourceBadge';

interface Step7ReportsExportProps {
  caseData: CaseRecord;
  graph: GraphResponse;
  inferenceResult: InferResponse | null;
  evidence: Record<string, string>;
}

export const Step7ReportsExport: React.FC<Step7ReportsExportProps> = ({
  caseData,
  graph,
  inferenceResult,
  evidence,
}) => {
  const [reportPayload, setReportPayload] = useState<any | null>(null);

  useEffect(() => {
    if (caseData.id) {
      api
        .getCaseReport(caseData.id)
        .then(setReportPayload)
        .catch(() => setReportPayload(null));
    }
  }, [caseData.id, evidence]);

  const handleExportJSON = () => {
    const exportData = reportPayload || {
      generated_at: new Date().toISOString(),
      case: caseData,
      evidence,
      inference: inferenceResult,
      notice:
        'Model estimates are based on historical NIBRS burglary data and are not proof.',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${caseData.case_number || 'case'}-reconstruction-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Action Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-100">
            Step 7: Forensic Reconstruction Report & Export (PDF / JSON)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Structured summary clearly separating Investigator-entered records, Uploaded evidence, Model estimates, and Missing/Unknown variables.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileJson className="w-4 h-4 text-blue-400" /> Export JSON Report
          </button>
          <button
            type="button"
            onClick={handlePrintPDF}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 shadow-lg shadow-blue-600/25 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Export / Print PDF Report
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        {/* Mandatory Non-Proof Legal/Forensic Disclaimer */}
        <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/70 flex items-start gap-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-amber-100">
            <div className="font-bold uppercase tracking-wider text-amber-300">
              Mandatory Evidentiary Notice
            </div>
            <p>
              Model estimates are based on historical NIBRS burglary data and are not proof.
              Probabilities reflect statistical associations across 6-hour time periods and
              categorical variables, never individual guilt or minute-level certainty.
            </p>
          </div>
        </div>

        {/* Section 1: Case Overview & Original Timestamp */}
        <div className="border-b border-slate-800 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100">
              1. Case Record: {caseData.case_number} — {caseData.title}
            </h3>
            <SourceBadge type="Investigator-entered" />
          </div>
          <p className="text-xs text-slate-300">{caseData.summary}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">
                Original Entered Timestamp
              </div>
              <div className="font-mono font-bold text-blue-300 mt-0.5">
                {caseData.time_mapping?.investigator_entered.formatted_display ||
                  `${caseData.incident_date} ${caseData.incident_time || ''}`}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Time Precision</div>
              <div className="font-bold text-slate-100 mt-0.5">
                {caseData.time_precision}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">
                Derived 6-Hour Model Window
              </div>
              <div className="font-bold text-slate-100 mt-0.5">
                {caseData.time_mapping?.model_mapping.time_period ||
                  'Unobserved / Marginalised'}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  (The model uses 6-hour time periods)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Investigator-Entered BN Evidence */}
        <div className="border-b border-slate-800 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">
              2. Observed Evidence Variables ({Object.keys(evidence).length})
            </h3>
            <SourceBadge type="Investigator-entered" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {Object.entries(evidence).map(([nodeId, stVal]) => {
              const nMeta = graph.nodes.find((n) => n.id === nodeId);
              const stMeta = nMeta?.states.find((s) => s.state === stVal);
              return (
                <div
                  key={nodeId}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <span className="text-slate-400 truncate">
                    {nMeta?.friendly_name || nodeId}:
                  </span>
                  <span className="font-semibold text-blue-200 truncate">
                    {stMeta?.label || stVal}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Uploaded Evidence Files */}
        <div className="border-b border-slate-800 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">
              3. Cataloged Forensic Media & Exhibits ({caseData.evidence_files.length})
            </h3>
            <SourceBadge type="Uploaded evidence" />
          </div>
          {caseData.evidence_files.length === 0 ? (
            <p className="text-xs text-slate-400">No external files attached.</p>
          ) : (
            <div className="space-y-1.5 text-xs">
              {caseData.evidence_files.map((f) => (
                <div
                  key={f.id}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono font-semibold text-slate-200">
                      {f.filename}
                    </span>{' '}
                    <span className="text-slate-400">({f.category})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Bayesian Network Posterior Estimates */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">
              4. Bayesian Network Posterior Estimates (Unobserved Variables)
            </h3>
            <SourceBadge type="Model estimate" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Variable</th>
                  <th className="py-2 px-3">Top Posterior State</th>
                  <th className="py-2 px-3 text-right">Posterior Prob.</th>
                  <th className="py-2 px-3 text-right">Prior Baseline</th>
                  <th className="py-2 px-3 text-right">Uncertainty (Entropy)</th>
                </tr>
              </thead>
              <tbody>
                {graph.nodes
                  .filter((n) => !(n.id in evidence))
                  .map((n) => {
                    const inf = inferenceResult?.nodes?.[n.id];
                    const top = inf?.top_state || n.states[0];
                    return (
                      <tr key={n.id} className="border-b border-slate-800/60">
                        <td className="py-2 px-3 font-semibold text-slate-200">
                          {n.friendly_name}
                        </td>
                        <td className="py-2 px-3 text-emerald-300">
                          {top.label} [{top.code}]
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-100">
                          {(((top.posterior ?? top.prior) || 0) * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400">
                          {(top.prior * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">
                          {inf?.entropy.uncertainty_level || 'Medium'} (
                          {(inf?.entropy.entropy_bits ?? 0).toFixed(2)}b)
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
