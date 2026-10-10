import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Network,
  FileText,
  Users,
  Upload,
  ClipboardCheck,
  Sparkles,
  FileSpreadsheet,
  Activity,
  Scale,
  ShieldAlert,
  FolderOpen,
  PlusCircle,
  Save,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';

import {
  GraphResponse,
  InferResponse,
  CaseRecord,
  PresetScenario,
} from './types';
import { api } from './api';
import { computeTimeMappingClient } from './utils/timeUtils';
import { GraphWorkspace } from './components/GraphWorkspace';
import { ScenarioComparisonView } from './components/ScenarioComparisonView';
import { HMMTemporalView } from './components/HMMTemporalView';
import { Step1CaseDetails } from './components/GuidedWorkflow/Step1CaseDetails';
import { Step2PeopleInvolved } from './components/GuidedWorkflow/Step2PeopleInvolved';
import { Step3EvidenceUpload } from './components/GuidedWorkflow/Step3EvidenceUpload';
import { Step4EvidenceReview } from './components/GuidedWorkflow/Step4EvidenceReview';
import { Step6ResultsTimeline } from './components/GuidedWorkflow/Step6ResultsTimeline';
import { Step7ReportsExport } from './components/GuidedWorkflow/Step7ReportsExport';

export type ActiveTab =
  | 'step1_details'
  | 'step2_people'
  | 'step3_evidence'
  | 'step4_review'
  | 'step5_graph'
  | 'step6_results'
  | 'step7_reports'
  | 'scenarios_tab'
  | 'hmm_tab';

function createBlankCase(): CaseRecord {
  const mapped = computeTimeMappingClient({
    incident_date: '2026-10-09',
    incident_time: '19:35',
    time_precision: 'Exact',
  });
  return {
    id: `case-${Date.now().toString(36)}`,
    case_number: 'NY-2026-0109',
    title: 'Evening Residential Burglary Investigation',
    summary:
      'Initial forensic reconstruction workspace. Enter incident date/time, scene observations, or load a preset demo case.',
    incident_date: '2026-10-09',
    incident_time: '19:35',
    time_precision: 'Exact',
    time_range_start: null,
    time_range_end: null,
    range_resolution: null,
    location: '35',
    address_notes: 'Single-family residence',
    victims: [],
    suspects: [],
    evidence_files: [],
    observations: [],
    manual_evidence: {
      incident_month: '10',
      day_type: 'Weekday',
      time_period: 'Evening',
      location: '35',
    },
    query_var: 'attempt_completed',
    time_mapping: mapped,
    conflicts: [],
  };
}

export const App: React.FC = () => {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [presets, setPresets] = useState<PresetScenario[]>([]);
  const [casesList, setCasesList] = useState<CaseRecord[]>([]);
  const [currentCase, setCurrentCase] = useState<CaseRecord>(createBlankCase);
  const [showEmptyWelcome, setShowEmptyWelcome] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const param = new URLSearchParams(window.location.search).get('tab') as ActiveTab | null;
    if (
      param &&
      [
        'step1_details',
        'step2_people',
        'step3_evidence',
        'step4_review',
        'step5_graph',
        'step6_results',
        'step7_reports',
        'scenarios_tab',
        'hmm_tab',
      ].includes(param)
    ) {
      return param;
    }
    return 'step5_graph';
  });
  const [inferenceResult, setInferenceResult] = useState<InferResponse | null>(null);
  const [isInferring, setIsInferring] = useState(false);
  const [saveBanner, setSaveBanner] = useState(false);

  const [customCompareScenarios, setCustomCompareScenarios] = useState<
    Array<{ name: string; evidence: Record<string, string> }> | undefined
  >(undefined);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);

  // Quick KPI metrics from inferenceResult
  const attemptResult = inferenceResult?.nodes?.['attempt_completed'];
  const topOutcomeLabel = attemptResult?.top_state?.label || 'Completed';
  const topOutcomeProb = Math.round((attemptResult?.top_state?.posterior ?? 0.95) * 100);
  const activeCluesCount = Object.keys(currentCase.manual_evidence).length;
  const uncertaintyLevel = attemptResult?.entropy?.uncertainty_level || 'Low';

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load of graph, presets, and saved/demo cases
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.getGraph(),
      api.getPresetScenarios().catch(() => ({ presets: [], notice: '' })),
      api.listCases().catch(() => ({ cases: [] })),
    ])
      .then(([gRes, pRes, cRes]) => {
        if (!mounted) return;
        setGraph(gRes);
        setPresets(pRes.presets || []);
        if (cRes.cases && cRes.cases.length > 0) {
          setCasesList(cRes.cases);
          setCurrentCase(cRes.cases[0]);
        }
      })
      .catch(console.error);
    return () => {
      mounted = false;
    };
  }, []);

  const triggerInference = useCallback(
    async (opts?: {
      evidenceOverride?: Record<string, string>;
      method?: 'exact' | 'gibbs' | 'both';
      samples?: number;
    }) => {
      const ev = opts?.evidenceOverride ?? currentCase.manual_evidence;
      const method = opts?.method ?? 'exact';
      const samples = opts?.samples ?? 5000;
      setIsInferring(true);
      try {
        const res = await api.infer({
          evidence: ev,
          query_vars: [
            currentCase.query_var || 'attempt_completed',
            'attempt_completed',
            'entry_method',
            'property_loss',
          ],
          method,
          samples,
        });
        setInferenceResult(res);
      } catch (err) {
        console.error('Inference error:', err);
      } finally {
        setIsInferring(false);
      }
    },
    [currentCase.manual_evidence, currentCase.query_var]
  );

  // Debounced live inference whenever evidence or query_var changes
  useEffect(() => {
    if (!graph) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerInference({ evidenceOverride: currentCase.manual_evidence });
    }, 120);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [graph, currentCase.manual_evidence, currentCase.query_var, triggerInference]);

  const handleUpdateCase = (
    updated: Partial<CaseRecord>,
    syncEvidence?: Record<string, string>
  ) => {
    setCurrentCase((prev) => {
      const next = {
        ...prev,
        ...updated,
        manual_evidence: syncEvidence ?? updated.manual_evidence ?? prev.manual_evidence,
      };
      return next;
    });
  };

  const handleSaveCaseToBackend = async () => {
    try {
      const saved = await api.saveCase(currentCase);
      setCurrentCase(saved);
      const listRes = await api.listCases();
      setCasesList(listRes.cases);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 2000);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleLoadDemo = async (demoId: string) => {
    try {
      const loaded = await api.loadDemoCase(demoId);
      setCurrentCase(loaded);
      setShowEmptyWelcome(false);
      const listRes = await api.listCases();
      setCasesList(listRes.cases);
    } catch (err) {
      console.error('Demo load failed:', err);
    }
  };

  const workflowSteps: Array<{
    id: ActiveTab;
    stepNum: number;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }> = [
    {
      id: 'step1_details',
      stepNum: 1,
      label: 'Case Details & Time',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: 'step2_people',
      stepNum: 2,
      label: 'People Involved',
      icon: <Users className="w-4 h-4" />,
      badge: currentCase.victims.length + currentCase.suspects.length || undefined,
    },
    {
      id: 'step3_evidence',
      stepNum: 3,
      label: 'Evidence Files',
      icon: <Upload className="w-4 h-4" />,
      badge: currentCase.evidence_files.length || undefined,
    },
    {
      id: 'step4_review',
      stepNum: 4,
      label: 'Evidence Review',
      icon: <ClipboardCheck className="w-4 h-4" />,
      badge: currentCase.observations.length || undefined,
    },
    {
      id: 'step5_graph',
      stepNum: 5,
      label: 'Graph & Analysis',
      icon: <Network className="w-4 h-4" />,
      badge: Object.keys(currentCase.manual_evidence).length,
    },
    {
      id: 'step6_results',
      stepNum: 6,
      label: 'Results & Timeline',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'step7_reports',
      stepNum: 7,
      label: 'Reports & Export',
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Persistent Evidentiary Notice Bar (Required by CORE FEATURE 2) */}
      <div
        data-testid="persistent-legal-notice"
        className="px-4 py-1.5 bg-amber-950/80 border-b border-amber-700/60 text-amber-200 text-xs flex items-center justify-center gap-2 font-medium no-print"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          Model estimates are based on historical NIBRS burglary data and are not proof.
        </span>
      </div>

      {/* Main Application Header */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-100">
              Probabilistic Crime Scene Reconstruction
            </h1>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Case: <strong className="text-slate-200 font-mono">{currentCase.case_number}</strong></span>
              <span>•</span>
              <span className="truncate max-w-xs">{currentCase.title}</span>
            </div>
          </div>
        </div>

        {/* Top-Line Executive KPI Summary Pill Bar */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px]">
          <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Reconstruction:</span>
            <span className="font-bold text-slate-100 font-mono">
              {topOutcomeLabel} {topOutcomeProb}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800">
            <span className="text-slate-400">Active Clues:</span>
            <span className="font-bold text-blue-300 font-mono">{activeCluesCount} / 20</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Uncertainty:</span>
            <span
              className={`font-semibold ${
                uncertaintyLevel === 'Low'
                  ? 'text-emerald-400'
                  : uncertaintyLevel === 'Medium'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {uncertaintyLevel}
            </span>
          </div>
        </div>

        {/* Center/Right: View Tabs & Case / Demo Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Analytical Tabs */}
          <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-1 text-xs">
            <button
              data-testid="tab-graph"
              onClick={() => setActiveTab('step5_graph')}
              className={`px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'step5_graph'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" /> Bayesian Network Graph
            </button>
            <button
              data-testid="tab-scenarios"
              onClick={() => setActiveTab('scenarios_tab')}
              className={`px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'scenarios_tab'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5" /> Scenario Comparison
            </button>
            <button
              data-testid="tab-hmm"
              onClick={() => setActiveTab('hmm_tab')}
              className={`px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'hmm_tab'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> HMM / Temporal View
            </button>
          </div>

          {/* Demo Case Selector */}
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-slate-400" />
            <select
              aria-label="Load Demo Case"
              data-testid="demo-case-select"
              value=""
              onChange={(e) => {
                if (e.target.value) handleLoadDemo(e.target.value);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 cursor-pointer"
            >
              <option value="">Load Demo Case...</option>
              <option value="demo-residential-night">
                Demo 1: Night + Forced Residential (#309261649)
              </option>
              <option value="demo-commercial-afternoon">
                Demo 2: Afternoon Non-Forced Commercial
              </option>
              <option value="demo-spanning-conflict">
                Demo 3: Spanning Range (04:45–07:15) + Conflict
              </option>
            </select>
          </div>

          <button
            onClick={() => {
              setCurrentCase(createBlankCase());
              setShowEmptyWelcome(true);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            title="Start a blank case or view first-run empty state"
          >
            <PlusCircle className="w-3.5 h-3.5" /> New Case
          </button>

          <button
            onClick={() => setIsZenMode((z) => !z)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs inline-flex items-center gap-1 transition cursor-pointer ${
              isZenMode
                ? 'bg-blue-600 border-blue-400 text-white font-semibold shadow-md'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title={isZenMode ? 'Exit Focus Mode (Show Sidebar)' : 'Focus Mode (Maximize Canvas)'}
          >
            {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isZenMode ? 'Exit Focus' : 'Focus Mode'}</span>
          </button>

          <button
            onClick={handleSaveCaseToBackend}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            {saveBanner ? (
              <>
                <Check className="w-3.5 h-3.5" /> Saved
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Case
              </>
            )}
          </button>
        </div>
      </header>

      {/* First-Run Empty State Banner when user clicks New Case */}
      {showEmptyWelcome && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-900 border border-blue-500/50 flex flex-wrap items-center justify-between gap-4 no-print">
          <div className="space-y-1">
            <div className="text-sm font-bold text-blue-200">
              First-Run Investigator Workspace — Load a Real NIBRS Demo Case or Enter Evidence
            </div>
            <p className="text-xs text-slate-300">
              Choose one of the 3 pre-built demo cases from the NY-2025 dataset to populate the 20-node Bayesian Network immediately:
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleLoadDemo('demo-residential-night')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
            >
              Load Demo 1 (Night + Forced)
            </button>
            <button
              onClick={() => handleLoadDemo('demo-commercial-afternoon')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
            >
              Load Demo 2 (Afternoon Commercial)
            </button>
            <button
              onClick={() => handleLoadDemo('demo-spanning-conflict')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
            >
              Load Demo 3 (Multi-Period + Conflict)
            </button>
            <button
              onClick={() => setShowEmptyWelcome(false)}
              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Body Layout: Left Guided Workflow Stepper + Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Guided Workflow Stepper (CORE FEATURE 5) */}
        <nav
          aria-label="Guided Workflow Steps"
          className={`${
            isZenMode ? 'hidden' : 'w-60'
          } bg-slate-900/95 border-r border-slate-800 p-3 flex flex-col justify-between shrink-0 no-print transition-all duration-200`}
        >
          <div className="space-y-1">
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Guided Investigator Workflow
            </div>
            {workflowSteps.map((step) => {
              const isActive = activeTab === step.id;
              return (
                <button
                  key={step.id}
                  data-testid={`nav-${step.id}`}
                  onClick={() => setActiveTab(step.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-200 border border-blue-500/50 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {step.stepNum}
                    </span>
                    <span className="truncate">{step.label}</span>
                  </div>
                  {step.badge !== undefined && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                      {step.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Saved Cases Quick Switcher at Bottom of Sidebar */}
          {casesList.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-1.5">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Saved Cases ({casesList.length})
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {casesList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCurrentCase(c)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] truncate cursor-pointer ${
                      c.id === currentCase.id
                        ? 'bg-slate-800 text-blue-300 font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    {c.case_number}: {c.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Main View Area */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {!graph ? (
            <div className="p-12 text-center text-sm text-slate-400">
              Loading 20-node Burglary Bayesian Network & NIBRS lookup tables...
            </div>
          ) : (
            <>
              {activeTab === 'step1_details' && (
                <Step1CaseDetails
                  caseData={currentCase}
                  graph={graph}
                  onUpdateCase={handleUpdateCase}
                  onCompareRangeScenarios={(scens) => {
                    setCustomCompareScenarios(scens);
                    setActiveTab('scenarios_tab');
                  }}
                />
              )}

              {activeTab === 'step2_people' && (
                <Step2PeopleInvolved
                  caseData={currentCase}
                  graph={graph}
                  onUpdateCase={handleUpdateCase}
                />
              )}

              {activeTab === 'step3_evidence' && (
                <Step3EvidenceUpload
                  caseData={currentCase}
                  onUpdateCase={handleUpdateCase}
                />
              )}

              {activeTab === 'step4_review' && (
                <Step4EvidenceReview
                  caseData={currentCase}
                  graph={graph}
                  onUpdateCase={handleUpdateCase}
                  onNavigateToGraph={() => setActiveTab('step5_graph')}
                />
              )}

              {activeTab === 'step5_graph' && (
                <div className="h-[calc(100vh-88px)]">
                  <GraphWorkspace
                    graph={graph}
                    evidence={currentCase.manual_evidence}
                    onChangeEvidence={(nextEv) =>
                      handleUpdateCase({ manual_evidence: nextEv }, nextEv)
                    }
                    queryVar={currentCase.query_var || 'attempt_completed'}
                    onChangeQueryVar={(q) => handleUpdateCase({ query_var: q })}
                    inferenceResult={inferenceResult}
                    onRunInference={triggerInference}
                    isInferring={isInferring}
                    presets={presets}
                    isZenMode={isZenMode}
                    onToggleZenMode={() => setIsZenMode((z) => !z)}
                  />
                </div>
              )}

              {activeTab === 'step6_results' && (
                <Step6ResultsTimeline
                  caseData={currentCase}
                  graph={graph}
                  inferenceResult={inferenceResult}
                  evidence={currentCase.manual_evidence}
                />
              )}

              {activeTab === 'step7_reports' && (
                <Step7ReportsExport
                  caseData={currentCase}
                  graph={graph}
                  inferenceResult={inferenceResult}
                  evidence={currentCase.manual_evidence}
                />
              )}

              {activeTab === 'scenarios_tab' && (
                <ScenarioComparisonView
                  graph={graph}
                  currentCaseEvidence={currentCase.manual_evidence}
                  presets={presets}
                  initialScenarios={customCompareScenarios}
                  onApplyScenarioToGraph={(ev, qVar) => {
                    handleUpdateCase(
                      { manual_evidence: ev, query_var: qVar },
                      ev
                    );
                    setActiveTab('step5_graph');
                  }}
                />
              )}

              {activeTab === 'hmm_tab' && (
                <HMMTemporalView
                  caseMonth={
                    Number(
                      currentCase.manual_evidence.incident_month ||
                        currentCase.time_mapping?.model_mapping.incident_month ||
                        10
                    )
                  }
                  caseTimePeriod={
                    currentCase.manual_evidence.time_period ||
                    currentCase.time_mapping?.model_mapping.time_period ||
                    'Night'
                  }
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
