import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
  ReactFlowInstance,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { toPng, toSvg } from 'html-to-image';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Search,
  RotateCcw,
  Eye,
  EyeOff,
  Download,
  Play,
  Table,
  Sparkles,
  X,
  CheckCircle2,
  HelpCircle,
  Sliders,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Maximize2,
  Minimize2,
} from 'lucide-react';

import {
  GraphResponse,
  InferResponse,
  CPDTableResponse,
  PresetScenario,
  SensitivityResponse,
} from '../types';
import { api } from '../api';
import { BNCustomNode } from './BNCustomNode';
import { TooltipBadge } from './TooltipBadge';
import { SourceBadge } from './SourceBadge';
import { ForensicBriefingCard } from './ForensicBriefingCard';
import { RapidWhatIfChips } from './RapidWhatIfChips';

const nodeTypes = {
  bnNode: BNCustomNode,
};

function computeDagreLayout(
  graph: GraphResponse,
  direction: 'LR' | 'TB' = 'LR'
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: direction === 'LR' ? 45 : 55,
    ranksep: direction === 'LR' ? 95 : 85,
    marginx: 30,
    marginy: 30,
  });

  const nodeWidth = 240;
  const nodeHeight = 148;

  for (const n of graph.nodes) {
    g.setNode(n.id, { width: nodeWidth, height: nodeHeight });
  }
  for (const e of graph.edges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of graph.nodes) {
    const pos = g.node(n.id);
    positions[n.id] = {
      x: (pos?.x ?? 0) - nodeWidth / 2,
      y: (pos?.y ?? 0) - nodeHeight / 2,
    };
  }
  return positions;
}

interface GraphWorkspaceProps {
  graph: GraphResponse;
  evidence: Record<string, string>;
  onChangeEvidence: (next: Record<string, string>) => void;
  queryVar: string;
  onChangeQueryVar: (q: string) => void;
  inferenceResult: InferResponse | null;
  onRunInference: (opts?: {
    evidenceOverride?: Record<string, string>;
    method?: 'exact' | 'gibbs' | 'both';
    samples?: number;
  }) => void;
  isInferring: boolean;
  presets: PresetScenario[];
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
}

export const GraphWorkspace: React.FC<GraphWorkspaceProps> = ({
  graph,
  evidence,
  onChangeEvidence,
  queryVar,
  onChangeQueryVar,
  inferenceResult,
  onRunInference,
  isInferring,
  presets,
  isZenMode,
  onToggleZenMode,
}) => {
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const [layoutDir, setLayoutDir] = useState<'LR' | 'TB'>('LR');
  const [showEdges, setShowEdges] = useState(true);
  const [showTechnicalNames, setShowTechnicalNames] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('attempt_completed');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{
    id: string;
    source_friendly: string;
    target_friendly: string;
    description: string;
  } | null>(null);

  // Inference method & Gibbs controls
  const [inferMethod, setInferMethod] = useState<'exact' | 'both'>('exact');
  const [gibbsSamples, setGibbsSamples] = useState<number>(5000);

  // CPD viewer state
  const [showCPD, setShowCPD] = useState(false);
  const [cpdData, setCpdData] = useState<CPDTableResponse | null>(null);
  const [cpdLoading, setCpdLoading] = useState(false);
  const [cpdFilter, setCpdFilter] = useState('');

  // Sensitivity ("What would change the answer most?") state
  const [sensitivity, setSensitivity] = useState<SensitivityResponse | null>(null);
  const [sensLoading, setSensLoading] = useState(false);
  const [showBottomDrawer, setShowBottomDrawer] = useState(true);

  const positions = useMemo(
    () => computeDagreLayout(graph, layoutDir),
    [graph, layoutDir]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Compute Markov blanket roles when a node is hovered
  const hoveredMeta = useMemo(
    () => graph.nodes.find((n) => n.id === hoveredNodeId) || null,
    [graph.nodes, hoveredNodeId]
  );

  // Sync React Flow nodes whenever graph, positions, inferenceResult, evidence, or hover changes
  useEffect(() => {
    const qLower = searchQuery.trim().toLowerCase();

    const rfNodes: Node[] = graph.nodes.map((meta) => {
      let highlightRole: 'self' | 'parent' | 'child' | 'spouse' | 'dimmed' | null = null;

      if (hoveredMeta) {
        if (hoveredMeta.id === meta.id) {
          highlightRole = 'self';
        } else if (hoveredMeta.parents.includes(meta.id)) {
          highlightRole = 'parent';
        } else if (hoveredMeta.children.includes(meta.id)) {
          highlightRole = 'child';
        } else if (hoveredMeta.spouses.includes(meta.id)) {
          highlightRole = 'spouse';
        } else {
          highlightRole = 'dimmed';
        }
      } else if (qLower) {
        const matches =
          meta.friendly_name.toLowerCase().includes(qLower) ||
          meta.id.toLowerCase().includes(qLower) ||
          meta.group.toLowerCase().includes(qLower);
        highlightRole = matches ? 'self' : 'dimmed';
      }

      return {
        id: meta.id,
        type: 'bnNode',
        position: positions[meta.id] || { x: 0, y: 0 },
        data: {
          meta,
          inference: inferenceResult?.nodes?.[meta.id],
          evidenceValue: evidence[meta.id],
          isSelected: selectedNodeId === meta.id,
          isQueryTarget: queryVar === meta.id,
          highlightRole,
          showTechnicalNames,
          layoutDirection: layoutDir,
          onNodeHover: setHoveredNodeId,
        },
      };
    });

    setNodes(rfNodes);
  }, [
    graph,
    positions,
    inferenceResult,
    evidence,
    selectedNodeId,
    queryVar,
    hoveredMeta,
    searchQuery,
    showTechnicalNames,
    layoutDir,
    setNodes,
  ]);

  // Sync React Flow edges
  useEffect(() => {
    if (!showEdges) {
      setEdges([]);
      return;
    }
    const rfEdges: Edge[] = graph.edges.map((e) => {
      const isConnectedToHover =
        hoveredNodeId && (e.source === hoveredNodeId || e.target === hoveredNodeId);
      const isConnectedToSelected =
        selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId);

      const strokeColor = isConnectedToHover
        ? '#38bdf8'
        : isConnectedToSelected
        ? '#60a5fa'
        : '#475569';

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: Boolean(isConnectedToHover || isConnectedToSelected),
        style: {
          stroke: strokeColor,
          strokeWidth: isConnectedToHover || isConnectedToSelected ? 2.5 : 1.6,
          opacity: hoveredNodeId && !isConnectedToHover ? 0.25 : 0.9,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 18,
          height: 18,
        },
        data: e as unknown as Record<string, unknown>,
      };
    });
    setEdges(rfEdges);
  }, [graph.edges, showEdges, hoveredNodeId, selectedNodeId, setEdges]);

  // Fetch sensitivity whenever evidence or queryVar changes
  useEffect(() => {
    let active = true;
    setSensLoading(true);
    api
      .getSensitivity({ evidence, query_var: queryVar, top_k: 6 })
      .then((res) => {
        if (active) setSensitivity(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSensLoading(false);
      });
    return () => {
      active = false;
    };
  }, [evidence, queryVar]);

  // Reset CPD view when switching selected node
  useEffect(() => {
    setShowCPD(false);
    setCpdData(null);
    setCpdFilter('');
  }, [selectedNodeId]);

  const handleLoadCPD = useCallback(async (nodeId: string) => {
    setShowCPD(true);
    setCpdLoading(true);
    try {
      const res = await api.getCPD(nodeId);
      setCpdData(res);
    } catch {
      setCpdData(null);
    } finally {
      setCpdLoading(false);
    }
  }, []);

  const handleSetNodeEvidence = (nodeId: string, stateVal: string | null) => {
    const next = { ...evidence };
    if (!stateVal) {
      delete next[nodeId];
    } else {
      next[nodeId] = stateVal;
    }
    onChangeEvidence(next);
  };

  const handleMarkUnknownOrMissing = (nodeMeta: GraphResponse['nodes'][0]) => {
    const next = { ...evidence };
    if (nodeMeta.supports_unknown_state) {
      next[nodeMeta.id] = 'Unknown';
    } else if (nodeMeta.states.some((s) => s.state === 'U')) {
      next[nodeMeta.id] = 'U';
    } else {
      // Leave unobserved so the BN marginalises over it
      delete next[nodeMeta.id];
    }
    onChangeEvidence(next);
  };

  const handleRelayout = (dir: 'LR' | 'TB') => {
    setLayoutDir(dir);
    setTimeout(() => {
      rfInstance?.fitView({ padding: 0.12, duration: 300 });
    }, 50);
  };

  const handleExportImage = async (format: 'png' | 'svg') => {
    if (!flowWrapperRef.current) return;
    try {
      const dataUrl =
        format === 'png'
          ? await toPng(flowWrapperRef.current, { backgroundColor: '#020617' })
          : await toSvg(flowWrapperRef.current, { backgroundColor: '#020617' });
      const link = document.createElement('a');
      link.download = `crime-scene-bn-graph.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const handleToggleWhatIf = (nodeId: string, value: string) => {
    const next = { ...evidence };
    if (next[nodeId] === value) {
      delete next[nodeId];
    } else {
      next[nodeId] = value;
    }
    onChangeEvidence(next);
  };

  const selectedMeta = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId]
  );

  const selectedInference = selectedNodeId
    ? inferenceResult?.nodes?.[selectedNodeId]
    : undefined;

  const queryNodeInference = inferenceResult?.nodes?.[queryVar];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Top Graph Control Toolbar */}
      <div className="px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Node */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 20 nodes..."
              aria-label="Search nodes"
              className="pl-8 pr-7 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Auto-Layout Direction */}
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-xs">
            <button
              onClick={() => handleRelayout('LR')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                layoutDir === 'LR'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Auto-layout Left-to-Right DAG (Dagre)"
            >
              Layout LR
            </button>
            <button
              onClick={() => handleRelayout('TB')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                layoutDir === 'TB'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Auto-layout Top-to-Bottom DAG (Dagre)"
            >
              Layout TB
            </button>
          </div>

          <button
            onClick={() => rfInstance?.fitView({ padding: 0.12, duration: 300 })}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1"
            title="Fit all 20 nodes in viewport"
          >
            <Layers className="w-3.5 h-3.5" /> Fit View
          </button>

          <button
            onClick={() => setShowEdges((s) => !s)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1"
          >
            {showEdges ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showEdges ? 'Hide Edges' : 'Show Edges'}
          </button>

          <button
            onClick={() => setShowTechnicalNames((s) => !s)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs inline-flex items-center gap-1 transition ${
              showTechnicalNames
                ? 'bg-amber-950/60 border-amber-600/60 text-amber-200'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {showTechnicalNames ? 'Hide Raw Var Names' : 'Technical Var Names'}
          </button>

          <button
            onClick={() => handleExportImage('png')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1"
            title="Export Bayesian Network graph as PNG"
          >
            <Download className="w-3.5 h-3.5" /> PNG
          </button>
          <button
            onClick={() => handleExportImage('svg')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1"
            title="Export Bayesian Network graph as SVG"
          >
            <Download className="w-3.5 h-3.5" /> SVG
          </button>

          {onToggleZenMode && (
            <button
              onClick={onToggleZenMode}
              className={`px-2.5 py-1.5 rounded-lg border text-xs inline-flex items-center gap-1 transition cursor-pointer ${
                isZenMode
                  ? 'bg-blue-600 border-blue-400 text-white font-semibold shadow-md'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={isZenMode ? 'Exit Focus Mode (Show Workflow)' : 'Focus Mode (Maximize Canvas)'}
            >
              {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isZenMode ? 'Exit Focus' : 'Focus Mode'}
            </button>
          )}
        </div>

        {/* Right Side: Query Variable Selector, Exact/Gibbs Toggle & Run Reconstruction Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Primary Query:</span>
            <select
              aria-label="Primary Query Variable"
              value={queryVar}
              onChange={(e) => onChangeQueryVar(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-purple-500/60 text-purple-200 text-xs font-medium focus:outline-none"
            >
              {graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.friendly_name}
                </option>
              ))}
            </select>
          </div>

          {/* Exact vs Gibbs Toggle */}
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-xs">
            <button
              onClick={() => {
                setInferMethod('exact');
                onRunInference({ method: 'exact' });
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                inferMethod === 'exact'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Exact (VE)
            </button>
            <button
              onClick={() => {
                setInferMethod('both');
                onRunInference({ method: 'both', samples: gibbsSamples });
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                inferMethod === 'both'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Exact + Gibbs Compare
            </button>
          </div>

          {Object.keys(evidence).length > 0 && (
            <button
              onClick={() => onChangeEvidence({})}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-700/60 text-rose-200 text-xs inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Evidence ({Object.keys(evidence).length})
            </button>
          )}

          <button
            onClick={() =>
              onRunInference({
                method: inferMethod,
                samples: gibbsSamples,
              })
            }
            disabled={isInferring}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isInferring ? 'Running Inference...' : 'Run Reconstruction'}
          </button>
        </div>
      </div>

      {/* Preset Scenarios Bar + Glossary Tooltips */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-medium mr-1">One-Click Presets:</span>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChangeQueryVar(p.query_var);
                onChangeEvidence(p.evidence);
                setSelectedNodeId(p.query_var);
              }}
              className="px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-blue-950/80 hover:border-blue-500/60 border border-slate-700 text-slate-200 text-[11px] transition cursor-pointer"
              title={p.description}
            >
              {p.name.replace(/^Scenario \d+:\s*/, '')}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <TooltipBadge termKey="bayesian_network" />
          <TooltipBadge termKey="posterior_probability" />
          <TooltipBadge termKey="evidence" />
          <TooltipBadge termKey="entropy" />
          <TooltipBadge termKey="markov_blanket" />
          <TooltipBadge termKey="gibbs_sampling" />
        </div>
      </div>

      {/* Rapid What-If Evidence Chips Bar */}
      <RapidWhatIfChips
        evidence={evidence}
        onToggleEvidence={handleToggleWhatIf}
        onClearAll={() => onChangeEvidence({})}
      />

      {/* Main Split Area: Left Canvas + Right Node Inspector Side Panel */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* React Flow Canvas */}
        <div ref={flowWrapperRef} className="flex-1 h-full relative bg-slate-950">
          {/* Floating Live Forensic Case Briefing Card */}
          <div className="absolute top-3 left-3 z-10 max-w-xl w-[calc(100%-24px)] sm:w-[500px] pointer-events-auto">
            <ForensicBriefingCard
              inferenceResult={inferenceResult}
              graph={graph}
              evidence={evidence}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onInit={(inst) => {
              setRfInstance(inst);
              setTimeout(() => inst.fitView({ padding: 0.12 }), 60);
            }}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onEdgeMouseEnter={(_, edge) => {
              if (edge.data) {
                setHoveredEdge(edge.data as any);
              }
            }}
            onEdgeMouseLeave={() => setHoveredEdge(null)}
            fitView
            minZoom={0.2}
            maxZoom={1.8}
          >
            <Background color="#1e293b" gap={20} size={1.2} />
            <Controls className="!bg-slate-900 !border-slate-700 !text-slate-100 [&>button]:!bg-slate-900 [&>button]:!border-slate-700 [&>button]:!fill-slate-200 hover:[&>button]:!bg-slate-800" />
            <MiniMap
              nodeColor={(n) => {
                const m = (n.data as any)?.meta;
                return m?.color || '#475569';
              }}
              maskColor="rgba(2, 6, 23, 0.75)"
              className="!bg-slate-900/90 !border !border-slate-700 !rounded-lg"
            />
          </ReactFlow>

          {/* Group Color Legend + Markov Blanket Highlight Legend Overlay */}
          <div className="absolute top-3 left-3 p-2.5 rounded-xl bg-slate-900/90 backdrop-blur border border-slate-800 shadow-lg flex flex-wrap items-center gap-3 text-[11px] pointer-events-none">
            {graph.groups.map((g) => (
              <div key={g.name} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                <span className="text-slate-300 font-medium">{g.name}</span>
              </div>
            ))}
            <div className="h-3 w-px bg-slate-700 mx-1" />
            <span className="text-sky-300">● Parent</span>
            <span className="text-emerald-300">● Child</span>
            <span className="text-amber-300">● Markov Spouse</span>
          </div>

          {/* Hovered Edge Plain-English Dependency Callout */}
          {hoveredEdge && (
            <div className="absolute top-14 left-3 max-w-md p-3 rounded-xl bg-slate-900/95 border border-blue-500/60 shadow-2xl text-xs z-30 pointer-events-none">
              <div className="font-bold text-blue-300 mb-0.5">
                Conditional Dependency: {hoveredEdge.source_friendly} →{' '}
                {hoveredEdge.target_friendly}
              </div>
              <div className="text-slate-200 leading-relaxed">
                {hoveredEdge.description}
              </div>
            </div>
          )}

          {/* Bottom Collapsible Drawer: Exact vs Gibbs Comparison & "What would change the answer most?" */}
          <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-auto">
            <div className="rounded-xl bg-slate-900/95 backdrop-blur border border-slate-700/90 shadow-2xl overflow-hidden">
              <div
                onClick={() => setShowBottomDrawer((o) => !o)}
                className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-200">
                  <span className="inline-flex items-center gap-1.5 text-purple-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    What Would Change "{ graph.nodes.find((n) => n.id === queryVar)?.friendly_name }"{' '}
                    Most? (Sensitivity Ranking)
                  </span>
                  {inferMethod === 'both' && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
                      Exact vs. Gibbs ({gibbsSamples.toLocaleString()} samples) Active
                    </span>
                  )}
                </div>
                <button className="text-slate-400 hover:text-slate-200">
                  {showBottomDrawer ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>
              </div>

              {showBottomDrawer && (
                <div className="p-3 grid grid-cols-1 lg:grid-cols-12 gap-4 max-h-56 overflow-y-auto">
                  {/* Sensitivity Helper */}
                  <div
                    className={
                      inferMethod === 'both' ? 'lg:col-span-7 space-y-2' : 'lg:col-span-12 space-y-2'
                    }
                  >
                    {sensLoading ? (
                      <div className="text-xs text-slate-400">
                        Calculating KL divergence & entropy reduction across unobserved variables...
                      </div>
                    ) : sensitivity && sensitivity.rankings.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {sensitivity.rankings.slice(0, 3).map((item, idx) => (
                          <div
                            key={item.node}
                            className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 flex flex-col justify-between gap-1.5"
                          >
                            <div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-100">
                                  #{idx + 1} {item.friendly_name}
                                </span>
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700/50">
                                  Max Δ {(item.max_posterior_shift * 100).toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                                {item.explanation}
                              </p>
                            </div>
                            {item.most_impactful_observation && (
                              <button
                                onClick={() =>
                                  handleSetNodeEvidence(
                                    item.node,
                                    item.most_impactful_observation!.candidate_state
                                  )
                                }
                                className="mt-1 w-full px-2 py-1 rounded bg-slate-800 hover:bg-blue-900/60 border border-slate-700 text-[10px] font-medium text-blue-300 text-left truncate cursor-pointer"
                              >
                                Test setting "{item.most_impactful_observation.candidate_state_label}" →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">
                        All relevant variables observed or query variable is already clamped as evidence.
                      </div>
                    )}
                  </div>

                  {/* Exact vs. Gibbs Comparison Panel (when enabled) */}
                  {inferMethod === 'both' && queryNodeInference && (
                    <div className="lg:col-span-5 border-l border-slate-800 pl-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-300">
                          Exact (VE) vs. Gibbs ({queryNodeInference.friendly_name})
                        </span>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-400">Samples:</label>
                          <select
                            value={gibbsSamples}
                            onChange={(e) => {
                              const s = Number(e.target.value);
                              setGibbsSamples(s);
                              onRunInference({ method: 'both', samples: s });
                            }}
                            className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-200"
                          >
                            <option value={1000}>1,000</option>
                            <option value={2500}>2,500</option>
                            <option value={5000}>5,000 (Default)</option>
                            <option value={10000}>10,000</option>
                          </select>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-1 pr-2">State</th>
                              <th className="py-1 px-2 text-right">Exact (VE)</th>
                              <th className="py-1 px-2 text-right">Gibbs MCMC</th>
                              <th className="py-1 pl-2 text-right">Abs. Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {queryNodeInference.states.slice(0, 5).map((st) => (
                              <tr key={st.state} className="border-b border-slate-900">
                                <td className="py-1 pr-2 text-slate-200 truncate max-w-[120px]">
                                  {st.label}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-emerald-300">
                                  {((st.exact_posterior ?? st.posterior ?? 0) * 100).toFixed(2)}%
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-amber-300">
                                  {((st.gibbs_posterior ?? st.posterior ?? 0) * 100).toFixed(2)}%
                                </td>
                                <td className="py-1 pl-2 text-right font-mono text-slate-400">
                                  {((st.abs_error ?? 0) * 100).toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side Panel: Node Inspector */}
        {selectedMeta && (
          <aside
            data-testid="node-inspector-panel"
            className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-y-auto shrink-0 z-20"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedMeta.color }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {selectedMeta.group} Node
                  </span>
                  {evidence[selectedMeta.id] ? (
                    <SourceBadge
                      type={
                        evidence[selectedMeta.id] === 'Unknown'
                          ? 'Missing/Unknown'
                          : 'Investigator-entered'
                      }
                    />
                  ) : (
                    <SourceBadge type="Model estimate" />
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-100 mt-1">
                  {selectedMeta.friendly_name}
                </h3>
                {showTechnicalNames && (
                  <div className="text-xs font-mono text-slate-400">
                    Variable ID: {selectedMeta.id}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="Close inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Plain-English Description */}
            <div className="p-4 border-b border-slate-800 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedMeta.description}
              </p>

              {/* Set as Evidence Dropdown + Clear + Mark as Unknown/Missing */}
              <div className="space-y-2 pt-1">
                <label
                  htmlFor="inspector-evidence-select"
                  className="block text-xs font-semibold text-slate-200"
                >
                  Set as Evidence (Observe Node State):
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="inspector-evidence-select"
                    data-testid="inspector-evidence-select"
                    value={evidence[selectedMeta.id] || ''}
                    onChange={(e) =>
                      handleSetNodeEvidence(
                        selectedMeta.id,
                        e.target.value ? e.target.value : null
                      )
                    }
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Unobserved (Model Estimate) --</option>
                    {selectedMeta.states.map((st) => (
                      <option key={st.state} value={st.state} title={st.tooltip}>
                        {st.label} (Code: {st.code})
                      </option>
                    ))}
                  </select>
                  {evidence[selectedMeta.id] && (
                    <button
                      onClick={() => handleSetNodeEvidence(selectedMeta.id, null)}
                      className="px-2.5 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-xs text-rose-200 font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleMarkUnknownOrMissing(selectedMeta)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-700/50 text-amber-200 text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {selectedMeta.supports_unknown_state
                      ? 'Mark as "Unknown" State'
                      : 'Mark as Missing (Marginalise)'}
                  </button>
                  <button
                    onClick={() => onChangeQueryVar(selectedMeta.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                      queryVar === selectedMeta.id
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {queryVar === selectedMeta.id ? 'Active Query' : 'Set as Query'}
                  </button>
                </div>
              </div>
            </div>

            {/* Posterior Probability Distribution Bar Chart & State List */}
            <div className="p-4 border-b border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Posterior Probability Distribution
                </span>
                {selectedInference && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedInference.entropy.uncertainty_level === 'Low'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                        : selectedInference.entropy.uncertainty_level === 'Medium'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700/50'
                        : 'bg-rose-950 text-rose-300 border border-rose-700/50'
                    }`}
                  >
                    Entropy: {selectedInference.entropy.entropy_bits.toFixed(2)} bits (
                    {selectedInference.entropy.uncertainty_level})
                  </span>
                )}
              </div>

              {/* Mini Recharts Horizontal Bar Chart for Top 8 States */}
              <div className="h-44 w-full bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={[...(selectedInference?.states || selectedMeta.states)]
                      .sort((a, b) => (b.posterior ?? b.prior) - (a.posterior ?? a.prior))
                      .slice(0, 7)
                      .map((s) => ({
                        name: s.label.length > 18 ? s.label.slice(0, 16) + '…' : s.label,
                        fullLabel: s.label,
                        code: s.code,
                        posteriorPct: Number(((s.posterior ?? s.prior) * 100).toFixed(2)),
                        priorPct: Number((s.prior * 100).toFixed(2)),
                      }))}
                    margin={{ top: 4, right: 18, left: 4, bottom: 4 }}
                  >
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fill: '#cbd5e1', fontSize: 10 }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '11px',
                      }}
                      formatter={(val: any, name: any) => [
                        `${val}%`,
                        name === 'posteriorPct' ? 'Posterior' : 'Prior',
                      ]}
                    />
                    <Bar dataKey="posteriorPct" radius={[0, 4, 4, 0]}>
                      {(selectedInference?.states || selectedMeta.states)
                        .slice(0, 7)
                        .map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={selectedMeta.color || '#3b82f6'}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Detailed State List with Tooltips and Prior Delta */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {[...(selectedInference?.states || selectedMeta.states)]
                  .sort((a, b) => (b.posterior ?? b.prior) - (a.posterior ?? a.prior))
                  .map((st) => {
                    const post = st.posterior ?? st.prior;
                    const delta = st.delta ?? 0;
                    const isEv = evidence[selectedMeta.id] === st.state;
                    return (
                      <div
                        key={st.state}
                        onClick={() =>
                          handleSetNodeEvidence(
                            selectedMeta.id,
                            isEv ? null : st.state
                          )
                        }
                        title={`${st.tooltip} — Click to toggle as evidence`}
                        className={`p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isEv
                            ? 'bg-blue-950/70 border-blue-500/70'
                            : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-medium text-slate-200 flex items-center gap-1.5">
                            {isEv && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                            <span className="truncate">{st.label}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              [{st.code}]
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono shrink-0">
                            <span className="font-bold text-slate-100">
                              {(post * 100).toFixed(2)}%
                            </span>
                            {Math.abs(delta) >= 0.001 && (
                              <span
                                className={`inline-flex items-center text-[10px] ${
                                  delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {delta > 0 ? (
                                  <ArrowUpRight className="w-3 h-3" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3" />
                                )}
                                {delta > 0 ? '+' : ''}
                                {(delta * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, post * 100)}%`,
                              backgroundColor: selectedMeta.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Markov Blanket Connections Summary */}
            <div className="p-4 border-b border-slate-800 space-y-2 text-xs">
              <div className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                Markov Blanket Connections
              </div>
              <div>
                <span className="text-sky-400 font-semibold">Parents: </span>
                <span className="text-slate-300">
                  {selectedMeta.parents.length > 0
                    ? selectedMeta.parents
                        .map((p) => graph.nodes.find((n) => n.id === p)?.friendly_name || p)
                        .join(', ')
                    : 'None (Root Node)'}
                </span>
              </div>
              <div>
                <span className="text-emerald-400 font-semibold">Children: </span>
                <span className="text-slate-300">
                  {selectedMeta.children.length > 0
                    ? selectedMeta.children
                        .map((c) => graph.nodes.find((n) => n.id === c)?.friendly_name || c)
                        .join(', ')
                    : 'None (Leaf Node)'}
                </span>
              </div>
            </div>

            {/* Expandable "View CPD" Learned Conditional Probability Table */}
            <div className="p-4 space-y-3">
              <button
                onClick={() => {
                  if (showCPD) {
                    setShowCPD(false);
                  } else {
                    handleLoadCPD(selectedMeta.id);
                  }
                }}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center justify-between cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-blue-400" />
                  View CPD (Learned Conditional Probability Table)
                </span>
                {showCPD ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showCPD && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  {cpdLoading ? (
                    <div className="text-slate-400 py-2">Loading learned CPD table...</div>
                  ) : cpdData ? (
                    <>
                      <div className="text-[11px] text-slate-400">
                        Conditioned on:{' '}
                        <strong className="text-slate-200">
                          {cpdData.parent_friendly_names.length > 0
                            ? cpdData.parent_friendly_names.join(', ')
                            : 'None (Unconditional Prior)'}
                        </strong>{' '}
                        ({cpdData.total_columns} parent state combination
                        {cpdData.total_columns > 1 ? 's' : ''})
                      </div>

                      {cpdData.total_columns > 1 && (
                        <input
                          type="text"
                          value={cpdFilter}
                          onChange={(e) => setCpdFilter(e.target.value)}
                          placeholder="Filter parent states..."
                          className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200"
                        />
                      )}

                      <div className="max-h-64 overflow-auto border border-slate-800 rounded">
                        <table className="w-full text-[10px] text-left border-collapse">
                          <thead className="bg-slate-900 sticky top-0">
                            <tr>
                              <th className="p-1.5 border-b border-slate-800 text-slate-300">
                                Parent Condition
                              </th>
                              {cpdData.states.map((s) => (
                                <th
                                  key={s.state}
                                  className="p-1.5 border-b border-slate-800 text-right text-slate-300"
                                >
                                  {s.label} ({s.state})
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {cpdData.columns
                              .filter(
                                (col) =>
                                  !cpdFilter ||
                                  col.parent_labels
                                    .toLowerCase()
                                    .includes(cpdFilter.toLowerCase())
                              )
                              .slice(0, 30)
                              .map((col) => (
                                <tr
                                  key={col.column_key}
                                  className="border-b border-slate-900 hover:bg-slate-900/50"
                                >
                                  <td className="p-1.5 text-slate-300 font-medium">
                                    {col.parent_labels}
                                  </td>
                                  {cpdData.states.map((s) => (
                                    <td
                                      key={s.state}
                                      className="p-1.5 text-right font-mono text-blue-300"
                                    >
                                      {(
                                        (col.probabilities[s.state] ?? 0) * 100
                                      ).toFixed(2)}
                                      %
                                    </td>
                                  ))}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-rose-400">Could not load CPD table.</div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
