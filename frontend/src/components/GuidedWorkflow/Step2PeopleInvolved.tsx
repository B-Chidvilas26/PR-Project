import React from 'react';
import { Users, UserPlus, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import {
  CaseRecord,
  GraphResponse,
  VictimPerson,
  SuspectPerson,
} from '../../types';
import { SourceBadge } from '../SourceBadge';

interface Step2PeopleInvolvedProps {
  caseData: CaseRecord;
  graph: GraphResponse;
  onUpdateCase: (
    updated: Partial<CaseRecord>,
    syncEvidence?: Record<string, string>
  ) => void;
}

export const Step2PeopleInvolved: React.FC<Step2PeopleInvolvedProps> = ({
  caseData,
  graph,
  onUpdateCase,
}) => {
  const getStates = (nodeId: string) =>
    graph.nodes.find((n) => n.id === nodeId)?.states || [];

  const syncPeopleToEvidence = (
    victims: VictimPerson[],
    suspects: SuspectPerson[]
  ) => {
    const nextEv = { ...caseData.manual_evidence };

    // Primary victim (index 0) maps to victim_* BN nodes
    if (victims.length > 0) {
      const v = victims[0];
      if (v.victim_type) nextEv.victim_type = v.victim_type;
      if (v.victim_age_group) nextEv.victim_age_group = v.victim_age_group;
      if (v.victim_sex) nextEv.victim_sex = v.victim_sex;
      if (v.victim_ethnicity) nextEv.victim_ethnicity = v.victim_ethnicity;
      if (v.resident_status) nextEv.resident_status = v.resident_status;
    } else {
      delete nextEv.victim_type;
      delete nextEv.victim_age_group;
      delete nextEv.victim_sex;
      delete nextEv.victim_ethnicity;
      delete nextEv.resident_status;
    }

    // Primary suspect (index 0) maps to relationship & offender_* BN nodes
    if (suspects.length > 0) {
      const s = suspects[0];
      if (s.relationship) nextEv.relationship = s.relationship;
      if (s.offender_age_group) nextEv.offender_age_group = s.offender_age_group;
      if (s.offender_sex) nextEv.offender_sex = s.offender_sex;
      if (s.offender_ethnicity) nextEv.offender_ethnicity = s.offender_ethnicity;
    } else {
      delete nextEv.relationship;
      delete nextEv.offender_age_group;
      delete nextEv.offender_sex;
      delete nextEv.offender_ethnicity;
    }

    onUpdateCase(
      { victims, suspects, manual_evidence: nextEv },
      nextEv
    );
  };

  const handleAddVictim = () => {
    const next: VictimPerson[] = [
      ...caseData.victims,
      {
        id: `vic-${Date.now()}`,
        label: `Victim #${caseData.victims.length + 1}`,
        victim_type: '4',
        victim_age_group: 'Adult',
        victim_sex: 'F',
        victim_ethnicity: '20',
        resident_status: 'R',
        notes: '',
      },
    ];
    syncPeopleToEvidence(next, caseData.suspects);
  };

  const handleAddSuspect = () => {
    const next: SuspectPerson[] = [
      ...caseData.suspects,
      {
        id: `sus-${Date.now()}`,
        label: `Suspect / Subject #${caseData.suspects.length + 1}`,
        relationship: 'Unknown',
        offender_age_group: 'Unknown',
        offender_sex: 'U',
        offender_ethnicity: '40',
        notes: '',
      },
    ];
    syncPeopleToEvidence(caseData.victims, next);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">
              Step 2: People Involved (Victims & Suspects / Offenders)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Add victims and known or unknown suspects. Attributes automatically map onto the Victim and Offender/Relationship nodes in the Bayesian Network.
          </p>
        </div>
        <SourceBadge type="Investigator-entered" />
      </div>

      {/* Victims Section */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-emerald-300">
              Victims ({caseData.victims.length})
            </h3>
            <p className="text-[11px] text-slate-400">
              Victim #1 maps directly to the network's Victim Category, Age Group, Sex, Ethnicity, and Residency nodes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddVictim}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Victim
          </button>
        </div>

        {caseData.victims.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
            No victim records entered yet. Click "Add Victim" to map victim attributes onto the Bayesian Network.
          </div>
        ) : (
          <div className="space-y-4">
            {caseData.victims.map((v, idx) => (
              <div
                key={v.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={v.label}
                      onChange={(e) => {
                        const next = caseData.victims.map((item) =>
                          item.id === v.id ? { ...item, label: e.target.value } : item
                        );
                        syncPeopleToEvidence(next, caseData.suspects);
                      }}
                      className="bg-transparent font-bold text-xs text-slate-100 border-b border-slate-700 focus:outline-none focus:border-emerald-400"
                    />
                    {idx === 0 && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Linked to BN Victim Nodes
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = caseData.victims.filter((item) => item.id !== v.id);
                      syncPeopleToEvidence(next, caseData.suspects);
                    }}
                    className="text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Victim Category
                    </label>
                    <select
                      value={v.victim_type}
                      onChange={(e) => {
                        const next = caseData.victims.map((item) =>
                          item.id === v.id
                            ? { ...item, victim_type: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(next, caseData.suspects);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('victim_type').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label} ({st.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Age Group
                    </label>
                    <select
                      value={v.victim_age_group}
                      onChange={(e) => {
                        const next = caseData.victims.map((item) =>
                          item.id === v.id
                            ? { ...item, victim_age_group: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(next, caseData.suspects);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('victim_age_group').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Victim Sex
                    </label>
                    <select
                      value={v.victim_sex}
                      onChange={(e) => {
                        const next = caseData.victims.map((item) =>
                          item.id === v.id
                            ? { ...item, victim_sex: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(next, caseData.suspects);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('victim_sex').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Victim Ethnicity
                    </label>
                    <select
                      value={v.victim_ethnicity}
                      onChange={(e) => {
                        const next = caseData.victims.map((item) =>
                          item.id === v.id
                            ? { ...item, victim_ethnicity: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(next, caseData.suspects);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('victim_ethnicity').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Residency Status
                    </label>
                    <select
                      value={v.resident_status}
                      onChange={(e) => {
                        const next = caseData.victims.map((item) =>
                          item.id === v.id
                            ? { ...item, resident_status: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(next, caseData.suspects);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('resident_status').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suspects / Offenders Section */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Suspects / Offenders ({caseData.suspects.length})
            </h3>
            <p className="text-[11px] text-slate-400">
              Suspect attributes default to "Unknown". Leave attributes as Unknown if unobserved so the network estimates them probabilistically.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddSuspect}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Suspect (Defaults to Unknown)
          </button>
        </div>

        {caseData.suspects.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
            No suspect records entered. Offender nodes remain unobserved so the Bayesian Network estimates their posterior distribution.
          </div>
        ) : (
          <div className="space-y-4">
            {caseData.suspects.map((s, idx) => (
              <div
                key={s.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={s.label}
                      onChange={(e) => {
                        const next = caseData.suspects.map((item) =>
                          item.id === s.id ? { ...item, label: e.target.value } : item
                        );
                        syncPeopleToEvidence(caseData.victims, next);
                      }}
                      className="bg-transparent font-bold text-xs text-slate-100 border-b border-slate-700 focus:outline-none focus:border-amber-400"
                    />
                    {idx === 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/60 text-[10px] font-semibold">
                        Linked to BN Offender Nodes
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = caseData.suspects.filter((item) => item.id !== s.id);
                      syncPeopleToEvidence(caseData.victims, next);
                    }}
                    className="text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Victim–Offender Relationship
                    </label>
                    <select
                      value={s.relationship}
                      onChange={(e) => {
                        const next = caseData.suspects.map((item) =>
                          item.id === s.id
                            ? { ...item, relationship: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(caseData.victims, next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('relationship').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label} ({st.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Offender Age Group
                    </label>
                    <select
                      value={s.offender_age_group}
                      onChange={(e) => {
                        const next = caseData.suspects.map((item) =>
                          item.id === s.id
                            ? { ...item, offender_age_group: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(caseData.victims, next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('offender_age_group').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Offender Sex
                    </label>
                    <select
                      value={s.offender_sex}
                      onChange={(e) => {
                        const next = caseData.suspects.map((item) =>
                          item.id === s.id
                            ? { ...item, offender_sex: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(caseData.victims, next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('offender_sex').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Offender Ethnicity
                    </label>
                    <select
                      value={s.offender_ethnicity}
                      onChange={(e) => {
                        const next = caseData.suspects.map((item) =>
                          item.id === s.id
                            ? { ...item, offender_ethnicity: e.target.value }
                            : item
                        );
                        syncPeopleToEvidence(caseData.victims, next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200"
                    >
                      {getStates('offender_ethnicity').map((st) => (
                        <option key={st.state} value={st.state}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
