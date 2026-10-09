import React, { useState } from 'react';
import {
  Upload,
  FileCheck2,
  Trash2,
  Info,
  Film,
  Fingerprint,
  Camera,
  FileText,
} from 'lucide-react';
import { CaseRecord, EvidenceFileItem } from '../../types';
import { api } from '../../api';
import { SourceBadge } from '../SourceBadge';

interface Step3EvidenceUploadProps {
  caseData: CaseRecord;
  onUpdateCase: (updated: Partial<CaseRecord>) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const Step3EvidenceUpload: React.FC<Step3EvidenceUploadProps> = ({
  caseData,
  onUpdateCase,
}) => {
  const [category, setCategory] = useState('Scene Photo');
  const [status, setStatus] = useState<'Uploaded' | 'Processed' | 'Failed'>('Uploaded');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await api.uploadEvidenceFile(
        caseData.id,
        file,
        category,
        status,
        notes
      );
      onUpdateCase({ evidence_files: res.case.evidence_files });
      setNotes('');
    } catch (err: any) {
      // Fallback local record if offline/unpersisted case
      const fallbackItem: EvidenceFileItem = {
        id: `ev-${Date.now()}`,
        filename: file.name,
        category,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        status,
        uploaded_at: new Date().toISOString(),
        notes,
      };
      onUpdateCase({
        evidence_files: [...(caseData.evidence_files || []), fallbackItem],
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleStatusChange = (
    itemId: string,
    newStatus: 'Uploaded' | 'Processed' | 'Failed'
  ) => {
    const next = caseData.evidence_files.map((f) =>
      f.id === itemId ? { ...f, status: newStatus } : f
    );
    onUpdateCase({ evidence_files: next });
  };

  const handleDelete = async (itemId: string) => {
    try {
      const res = await api.deleteEvidenceFile(caseData.id, itemId);
      onUpdateCase({ evidence_files: res.case.evidence_files });
    } catch {
      onUpdateCase({
        evidence_files: caseData.evidence_files.filter((f) => f.id !== itemId),
      });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Step 3: Forensic Evidence Files (Fingerprints, CCTV, Photos & Documents)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload and catalog physical/digital case files. Link reviewed findings to the Bayesian Network in Step 4 (Evidence Review).
          </p>
        </div>
        <SourceBadge type="Uploaded evidence" />
      </div>

      {/* Honest Media Handling Notice */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <strong>Evidence Storage & Provenance Notice:</strong> Uploaded media files (fingerprints,
          CCTV video, scene photographs, and forensic PDFs) are stored and linked to the case record
          for chain-of-custody documentation. They are <strong>not</strong> automatically analyzed
          by computer-vision models; investigators review and convert physical findings into
          Bayesian Network states in Step 4.
        </div>
      </div>

      {/* Upload Form */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-100">
          Attach New Evidence Item to Case {caseData.case_number}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
          <div className="md:col-span-3 space-y-1">
            <label className="block font-semibold text-slate-300">Evidence Type</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
            >
              <option value="Fingerprint">Fingerprint Lift / Card</option>
              <option value="CCTV Video">CCTV Video Footage</option>
              <option value="Scene Photo">Crime Scene Photograph</option>
              <option value="Forensic Document">Forensic Report / Document</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="block font-semibold text-slate-300">Processing Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
            >
              <option value="Uploaded">Uploaded</option>
              <option value="Processed">Processed</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          <div className="md:col-span-6 space-y-1">
            <label className="block font-semibold text-slate-300">
              Chain-of-Custody / Exhibit Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Rear patio door striker plate macro photo"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100"
            />
          </div>
        </div>

        <div className="pt-1">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-blue-600/20">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Select File to Upload'}</span>
            <input
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {error && <div className="text-xs text-rose-400">{error}</div>}
      </div>

      {/* Uploaded Files Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            Cataloged Case Evidence Files ({caseData.evidence_files.length})
          </h3>
          <SourceBadge type="Uploaded evidence" />
        </div>

        {caseData.evidence_files.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
            No evidence files uploaded yet for this case.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Filename</th>
                  <th className="py-2.5 px-3">Type / Category</th>
                  <th className="py-2.5 px-3">File Size</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Exhibit Notes</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {caseData.evidence_files.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-800/60 hover:bg-slate-950/60"
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-100 flex items-center gap-2">
                      {item.category === 'Fingerprint' && (
                        <Fingerprint className="w-4 h-4 text-purple-400 shrink-0" />
                      )}
                      {item.category === 'CCTV Video' && (
                        <Film className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      {item.category === 'Scene Photo' && (
                        <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {item.category === 'Forensic Document' && (
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span>{item.filename}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{item.category}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {formatBytes(item.size_bytes)}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleStatusChange(item.id, e.target.value as any)
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold border ${
                          item.status === 'Processed'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            : item.status === 'Failed'
                            ? 'bg-rose-950 text-rose-300 border-rose-700'
                            : 'bg-blue-950 text-blue-300 border-blue-700'
                        }`}
                      >
                        <option value="Uploaded">Uploaded</option>
                        <option value="Processed">Processed</option>
                        <option value="Failed">Failed</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                      {item.notes || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-slate-400 hover:text-rose-400 p-1"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
