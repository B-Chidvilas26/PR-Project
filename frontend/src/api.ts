import {
  GraphResponse,
  InferResponse,
  ScenarioCompareResponse,
  SensitivityResponse,
  CPDTableResponse,
  HMMOverviewResponse,
  HMMEstimateResponse,
  CaseRecord,
  PresetScenario,
} from './types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errText = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.detail) {
        errText = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      } else if (data.message) {
        errText = data.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getGraph(): Promise<GraphResponse> {
    return fetch(`${API_BASE}/graph`).then((r) => handleResponse<GraphResponse>(r));
  },

  infer(params: {
    evidence: Record<string, string>;
    query_vars?: string[];
    method?: 'exact' | 'gibbs' | 'both';
    samples?: number;
    seed?: number;
  }): Promise<InferResponse> {
    return fetch(`${API_BASE}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => handleResponse<InferResponse>(r));
  },

  getPresetScenarios(): Promise<{ presets: PresetScenario[]; notice: string }> {
    return fetch(`${API_BASE}/scenarios/presets`).then((r) =>
      handleResponse<{ presets: PresetScenario[]; notice: string }>(r)
    );
  },

  compareScenarios(params: {
    scenarios: Array<{ name: string; evidence: Record<string, string> }>;
    query_var: string;
  }): Promise<ScenarioCompareResponse> {
    return fetch(`${API_BASE}/scenarios/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => handleResponse<ScenarioCompareResponse>(r));
  },

  getSensitivity(params: {
    evidence: Record<string, string>;
    query_var: string;
    top_k?: number;
  }): Promise<SensitivityResponse> {
    return fetch(`${API_BASE}/sensitivity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => handleResponse<SensitivityResponse>(r));
  },

  getCPD(node: string): Promise<CPDTableResponse> {
    return fetch(`${API_BASE}/cpd/${encodeURIComponent(node)}`).then((r) =>
      handleResponse<CPDTableResponse>(r)
    );
  },

  getHMM(): Promise<HMMOverviewResponse> {
    return fetch(`${API_BASE}/hmm`).then((r) => handleResponse<HMMOverviewResponse>(r));
  },

  estimateHMMCell(month: number, time_period: string): Promise<HMMEstimateResponse> {
    return fetch(`${API_BASE}/hmm/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, time_period }),
    }).then((r) => handleResponse<HMMEstimateResponse>(r));
  },

  listCases(): Promise<{ cases: CaseRecord[] }> {
    return fetch(`${API_BASE}/cases`).then((r) => handleResponse<{ cases: CaseRecord[] }>(r));
  },

  loadDemoCase(demoId: string): Promise<CaseRecord> {
    return fetch(`${API_BASE}/cases/demo/${encodeURIComponent(demoId)}`, {
      method: 'POST',
    }).then((r) => handleResponse<CaseRecord>(r));
  },

  saveCase(caseData: Partial<CaseRecord>): Promise<CaseRecord> {
    const method = caseData.id ? 'PUT' : 'POST';
    const url = caseData.id
      ? `${API_BASE}/cases/${encodeURIComponent(caseData.id)}`
      : `${API_BASE}/cases`;
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(caseData),
    }).then((r) => handleResponse<CaseRecord>(r));
  },

  uploadEvidenceFile(
    caseId: string,
    file: File,
    category: string,
    status: string,
    notes: string
  ): Promise<{ evidence: any; case: CaseRecord }> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    fd.append('status', status);
    fd.append('notes', notes);
    return fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/evidence`, {
      method: 'POST',
      body: fd,
    }).then((r) => handleResponse<{ evidence: any; case: CaseRecord }>(r));
  },

  deleteEvidenceFile(
    caseId: string,
    evidenceId: string
  ): Promise<{ deleted: boolean; case: CaseRecord }> {
    return fetch(
      `${API_BASE}/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}`,
      { method: 'DELETE' }
    ).then((r) => handleResponse<{ deleted: boolean; case: CaseRecord }>(r));
  },

  getCaseReport(caseId: string): Promise<any> {
    return fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/report`).then((r) =>
      handleResponse<any>(r)
    );
  },
};
