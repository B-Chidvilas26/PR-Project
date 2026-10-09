import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
} from 'lucide-react';
import { CaseRecord, GraphResponse } from '../../types';
import { computeTimeMappingClient } from '../../utils/timeUtils';
import { SourceBadge } from '../SourceBadge';

interface Step1CaseDetailsProps {
  caseData: CaseRecord;
  graph: GraphResponse;
  onUpdateCase: (updated: Partial<CaseRecord>, syncEvidence?: Record<string, string>) => void;
  onCompareRangeScenarios?: (
    scenarios: Array<{ name: string; evidence: Record<string, string> }>
  ) => void;
}

export const Step1CaseDetails: React.FC<Step1CaseDetailsProps> = ({
  caseData,
  graph,
  onUpdateCase,
  onCompareRangeScenarios,
}) => {
  const [showTechProvenance, setShowTechProvenance] = useState(false);

  const locationNode = useMemo(
    () => graph.nodes.find((n) => n.id === 'location'),
    [graph.nodes]
  );

  // Live client-side validation & mapping of Date / Time / Precision / Range
  const timeValidation = useMemo(() => {
    try {
      const res = computeTimeMappingClient({
        incident_date: caseData.incident_date,
        incident_time: caseData.incident_time,
        time_precision: caseData.time_precision,
        time_range_start: caseData.time_range_start,
        time_range_end: caseData.time_range_end,
        range_resolution: caseData.range_resolution,
      });
      return { valid: true as const, data: res, error: null };
    } catch (err: any) {
      return { valid: false as const, data: null, error: err.message as string };
    }
  }, [
    caseData.incident_date,
    caseData.incident_time,
    caseData.time_precision,
    caseData.time_range_start,
    caseData.time_range_end,
    caseData.range_resolution,
  ]);

  const applyTimeAndLocationToGraph = (
    overrides: Partial<CaseRecord> = {}
  ) => {
    const merged = { ...caseData, ...overrides };
    try {
      const mapped = computeTimeMappingClient({
        incident_date: merged.incident_date,
        incident_time: merged.incident_time,
        time_precision: merged.time_precision,
        time_range_start: merged.time_range_start,
        time_range_end: merged.time_range_end,
        range_resolution: merged.range_resolution,
      });
      const nextEv = { ...merged.manual_evidence };
      if (mapped.model_mapping.incident_month) {
        nextEv.incident_month = mapped.model_mapping.incident_month;
      }
      if (mapped.model_mapping.day_type) {
        nextEv.day_type = mapped.model_mapping.day_type;
      }
      if (mapped.model_mapping.time_period) {
        nextEv.time_period = mapped.model_mapping.time_period;
      } else {
        delete nextEv.time_period;
      }
      if (merged.location) {
        nextEv.location = merged.location;
      }
      onUpdateCase({ ...overrides, manual_evidence: nextEv, time_mapping: mapped }, nextEv);
    } catch {
      onUpdateCase(overrides);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Step 1: Case Details, Incident Date/Time & Scene Location
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enter the investigator-recorded case identifiers, incident date, minute-level time or approximate range, and location.
          </p>
        </div>
        <SourceBadge type="Investigator-entered" />
      </div>

      {/* Case Metadata Section */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4 space-y-1.5">
          <label
            htmlFor="case-id-input"
            className="block text-xs font-semibold text-slate-300"
          >
            Case ID / Reference Number
          </label>
          <input
            id="case-id-input"
            type="text"
            value={caseData.case_number}
            onChange={(e) => onUpdateCase({ case_number: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-8 space-y-1.5">
          <label
            htmlFor="case-title-input"
            className="block text-xs font-semibold text-slate-300"
          >
            Case Title
          </label>
          <input
            id="case-title-input"
            type="text"
            value={caseData.title}
            onChange={(e) => onUpdateCase({ title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-12 space-y-1.5">
          <label
            htmlFor="case-summary-input"
            className="block text-xs font-semibold text-slate-300"
          >
            Investigative Summary & Initial Observations
          </label>
          <textarea
            id="case-summary-input"
            rows={2}
            value={caseData.summary}
            onChange={(e) => onUpdateCase({ summary: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Incident Date & Time Card (CORE FEATURE 4) */}
      <div
        data-testid="incident-datetime-card"
        className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Incident Date, Time & Temporal Precision
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 italic">
              The model uses 6-hour time periods.
            </span>
            <SourceBadge type="Investigator-entered" />
          </div>
        </div>

        {/* Precision Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Time Precision Mode (Never forces a fake exact time)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['Exact', 'Approximate', 'Time Unknown'] as const).map((prec) => (
              <button
                key={prec}
                type="button"
                data-testid={`precision-btn-${prec}`}
                onClick={() =>
                  applyTimeAndLocationToGraph({
                    time_precision: prec,
                    range_resolution: prec === 'Time Unknown' ? null : caseData.range_resolution,
                  })
                }
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  caseData.time_precision === prec
                    ? 'bg-blue-950/70 border-blue-500 text-blue-100 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>{prec}</span>
                  {caseData.time_precision === prec && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {prec === 'Exact' && 'Known minute-level timestamp (e.g., alarm or CCTV log)'}
                  {prec === 'Approximate' &&
                    'Estimated time or start–end window (e.g., 18:30–20:15)'}
                  {prec === 'Time Unknown' &&
                    'Unrecorded time — never assigns a made-up hour'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Incident Date (typed or picked) */}
          <div className="md:col-span-4 space-y-1.5">
            <label
              htmlFor="incident-date-input"
              className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Incident Date (YYYY-MM-DD)
            </label>
            <input
              id="incident-date-input"
              data-testid="incident-date-input"
              type="date"
              value={caseData.incident_date || ''}
              onChange={(e) =>
                applyTimeAndLocationToGraph({ incident_date: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Incident Time (HH:MM) when Exact or Approximate */}
          {caseData.time_precision !== 'Time Unknown' && (
            <div className="md:col-span-4 space-y-1.5">
              <label
                htmlFor="incident-time-input"
                className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                {caseData.time_precision === 'Exact'
                  ? 'Incident Time (HH:MM, 24h)'
                  : 'Point Estimate Time (Optional HH:MM)'}
              </label>
              <input
                id="incident-time-input"
                data-testid="incident-time-input"
                type="text"
                placeholder="19:35"
                value={caseData.incident_time || ''}
                onChange={(e) =>
                  applyTimeAndLocationToGraph({ incident_time: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Optional Time Range (start - end) for Approximate times */}
          {caseData.time_precision === 'Approximate' && (
            <div className="md:col-span-4 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="time-range-start-input"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Range Start (HH:MM)
                </label>
                <input
                  id="time-range-start-input"
                  data-testid="time-range-start-input"
                  type="text"
                  placeholder="18:30"
                  value={caseData.time_range_start || ''}
                  onChange={(e) =>
                    applyTimeAndLocationToGraph({ time_range_start: e.target.value })
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="time-range-end-input"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Range End (HH:MM)
                </label>
                <input
                  id="time-range-end-input"
                  data-testid="time-range-end-input"
                  type="text"
                  placeholder="20:15"
                  value={caseData.time_range_end || ''}
                  onChange={(e) =>
                    applyTimeAndLocationToGraph({ time_range_end: e.target.value })
                  }
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Time Unknown Mode Option: Set as "Unknown" vs Leave Unobserved */}
          {caseData.time_precision === 'Time Unknown' && (
            <div className="md:col-span-8 p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-amber-300">
                Unrecorded Time Handling in Bayesian Network:
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    applyTimeAndLocationToGraph({ range_resolution: 'unknown' })
                  }
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                    caseData.range_resolution !== 'unobserved'
                      ? 'bg-amber-950 border-amber-500 text-amber-200 font-semibold'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Set Time Period = "Unknown" State
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyTimeAndLocationToGraph({ range_resolution: 'unobserved' })
                  }
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                    caseData.range_resolution === 'unobserved'
                      ? 'bg-blue-950 border-blue-500 text-blue-200 font-semibold'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Leave Unobserved (Marginalise Over All Periods)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Validation Error Beside Field in Plain English */}
        {!timeValidation.valid && timeValidation.error && (
          <div
            data-testid="datetime-error-msg"
            role="alert"
            className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{timeValidation.error}</span>
          </div>
        )}

        {/* Multi-Period Range Warning & Resolution Options (Never Collapse Silently!) */}
        {timeValidation.valid &&
          timeValidation.data?.model_mapping.spans_multiple_periods && (
            <div
              data-testid="spanning-range-alert"
              className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/70 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-amber-200">
                    Approximate Time Range Spans Multiple 6-Hour Periods (
                    {timeValidation.data.model_mapping.spanned_periods.join(' & ')})
                  </div>
                  <p className="text-amber-100/90 leading-relaxed">
                    {timeValidation.data.model_mapping.warning}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    applyTimeAndLocationToGraph({ range_resolution: 'unknown' })
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                    caseData.range_resolution === 'unknown'
                      ? 'bg-amber-600 border-amber-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-amber-200 hover:bg-slate-800'
                  }`}
                >
                  Set Time Period as "Unknown"
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyTimeAndLocationToGraph({ range_resolution: 'unobserved' })
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                    caseData.range_resolution === 'unobserved'
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-blue-200 hover:bg-slate-800'
                  }`}
                >
                  Leave Time Period Unobserved (Marginalise)
                </button>

                {onCompareRangeScenarios && (
                  <button
                    type="button"
                    data-testid="compare-spanned-periods-btn"
                    onClick={() =>
                      onCompareRangeScenarios(
                        timeValidation.data!.model_mapping.candidate_scenarios
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Compare One Scenario per Period (
                    {timeValidation.data.model_mapping.spanned_periods.join(' vs. ')})
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Live Investigator-Entered Timestamp & Model Mapping Preview Bar */}
        {timeValidation.valid && timeValidation.data && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Recorded Case Timestamp:
                </span>
                <SourceBadge type="Investigator-entered" />
              </div>
              <div
                data-testid="formatted-timestamp-display"
                className="text-base font-bold font-mono text-blue-300"
              >
                {timeValidation.data.investigator_entered.formatted_display}
              </div>
              <div className="text-[11px] text-slate-400">
                Precision: <strong>{caseData.time_precision}</strong> — preserved as entered in timeline and reports.
              </div>
            </div>

            <div className="space-y-1.5 md:border-l md:border-slate-800 md:pl-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Derived Bayesian Network Inputs:
                </span>
                <span className="text-[10px] text-slate-400">
                  The model uses 6-hour time periods.
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200">
                  Month:{' '}
                  <strong>
                    {timeValidation.data.model_mapping.incident_month || 'Unset'}
                  </strong>
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200">
                  Day Type:{' '}
                  <strong>
                    {timeValidation.data.model_mapping.day_type || 'Unset'}
                  </strong>{' '}
                  ({timeValidation.data.model_mapping.day_of_week})
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-900 border border-blue-500/40 text-blue-200">
                  6-Hour Period:{' '}
                  <strong>
                    {timeValidation.data.model_mapping.time_period ||
                      'Unobserved (Multi-Period / Marginalised)'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scene Location Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Primary Scene Location Category
            </h3>
          </div>
          <SourceBadge type="Investigator-entered" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 space-y-1.5">
            <label
              htmlFor="scene-location-select"
              className="block text-xs font-semibold text-slate-300"
            >
              Premises / Location Type
            </label>
            <select
              id="scene-location-select"
              value={caseData.location || ''}
              onChange={(e) =>
                applyTimeAndLocationToGraph({ location: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Unobserved Location --</option>
              {locationNode?.states.map((st) => (
                <option key={st.state} value={st.state} title={st.tooltip}>
                  {st.label} (Code {st.code})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-6 space-y-1.5">
            <label
              htmlFor="scene-address-notes"
              className="block text-xs font-semibold text-slate-300"
            >
              Scene Address / Specific Access Notes
            </label>
            <input
              id="scene-address-notes"
              type="text"
              value={caseData.address_notes || ''}
              onChange={(e) => onUpdateCase({ address_notes: e.target.value })}
              placeholder="e.g., Single-family residence, rear patio sliding door"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Collapsed "Technical Details & Provenance" Section (Required by CORE FEATURE 4) */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTechProvenance((s) => !s)}
          className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <span>Technical Details & Provenance (Dataset & Variable Mapping)</span>
          {showTechProvenance ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {showTechProvenance && (
          <div className="p-5 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-2 leading-relaxed">
            <p>
              • <strong>Dataset Provenance:</strong> The underlying Discrete Bayesian Network (
              <code>burglary_bn_model.pkl</code>) and Hidden Markov Model (
              <code>burglary_hmm_model.pkl</code>) were trained on NY-2025 NIBRS burglary offense
              records (Offense Code <code>220</code>, <code>burglary_bn_dataset.csv</code>).
            </p>
            <p>
              • <strong>Temporal Binning Rules:</strong> Raw NIBRS incident hours (0–23) are grouped
              into four 6-hour periods in <code>prepare_bn_dataset.py</code>:{' '}
              <code>Night (0–5)</code>, <code>Morning (6–11)</code>, <code>Afternoon (12–17)</code>,
              and <code>Evening (18–23)</code>, plus <code>Unknown</code>.
            </p>
            <p>
              • <strong>Raw BN Variables Updated by Step 1:</strong>{' '}
              <code>incident_month</code>, <code>day_type</code>, <code>time_period</code>, and{' '}
              <code>location</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
