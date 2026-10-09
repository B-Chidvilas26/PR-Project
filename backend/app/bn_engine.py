import math
import pickle
import random
from typing import Dict, List, Any, Optional
import numpy as np
import networkx as nx
from pgmpy.inference import VariableElimination

from .config import BN_MODEL_PATH
from .lookups import (
    NODE_GROUPS,
    GROUP_COLORS,
    FRIENDLY_NODE_NAMES,
    NODE_DESCRIPTIONS,
    EDGE_DESCRIPTIONS,
    lookup_registry,
)

PERSISTENT_NOTICE = "Model estimates are based on historical NIBRS burglary data and are not proof."


def compute_entropy_metrics(probs: List[float]) -> Dict[str, Any]:
    """Compute Shannon entropy (bits), normalized entropy [0,1], and Low/Medium/High uncertainty."""
    k = len(probs)
    if k <= 1:
        return {"entropy_bits": 0.0, "normalized_entropy": 0.0, "uncertainty_level": "Low"}

    entropy = 0.0
    for p in probs:
        if p > 1e-12:
            entropy -= p * math.log2(p)

    max_entropy = math.log2(k)
    norm_entropy = min(1.0, max(0.0, entropy / max_entropy)) if max_entropy > 0 else 0.0

    if norm_entropy < 0.35:
        level = "Low"
    elif norm_entropy < 0.70:
        level = "Medium"
    else:
        level = "High"

    return {
        "entropy_bits": round(float(entropy), 4),
        "max_entropy_bits": round(float(max_entropy), 4),
        "normalized_entropy": round(float(norm_entropy), 4),
        "uncertainty_level": level,
    }


def compute_kl_divergence(p_new: List[float], p_ref: List[float]) -> float:
    """Compute KL(p_new || p_ref) in bits with small epsilon smoothing."""
    eps = 1e-9
    kl = 0.0
    for pn, pr in zip(p_new, p_ref):
        pn_c = max(pn, eps)
        pr_c = max(pr, eps)
        kl += pn_c * math.log2(pn_c / pr_c)
    return max(0.0, float(kl))


class BayesianNetworkEngine:
    """Wraps the pre-trained pgmpy DiscreteBayesianNetwork for exact and Gibbs inference."""

    def __init__(self) -> None:
        with open(BN_MODEL_PATH, "rb") as f:
            self.model = pickle.load(f)

        self.inference = VariableElimination(self.model)
        self.nodes: List[str] = list(self.model.nodes())
        self.edges: List[tuple[str, str]] = list(self.model.edges())
        self.topological_order: List[str] = list(nx.topological_sort(self.model))

        self.cpds = {node: self.model.get_cpds(node) for node in self.nodes}
        self.state_names: Dict[str, List[str]] = {
            node: [str(s) for s in self.cpds[node].state_names[node]]
            for node in self.nodes
        }
        self.state_indices: Dict[str, Dict[str, int]] = {
            node: {state: i for i, state in enumerate(self.state_names[node])}
            for node in self.nodes
        }

        # Precompute priors for all 20 nodes once at startup
        self.priors: Dict[str, Dict[str, float]] = {}
        self._compute_priors()

    def _compute_priors(self) -> None:
        for node in self.nodes:
            res = self.inference.query(variables=[node], show_progress=False)
            states = res.state_names[node]
            vals = res.values
            self.priors[node] = {
                str(s): float(v) for s, v in zip(states, vals)
            }

    def is_dag(self) -> bool:
        return bool(nx.is_directed_acyclic_graph(self.model))

    def validate_evidence(self, evidence: Optional[Dict[str, str]]) -> Dict[str, str]:
        """Validate evidence keys and state values against the learned model's states."""
        if not evidence:
            return {}
        cleaned: Dict[str, str] = {}
        for node, value in evidence.items():
            if node not in self.state_names:
                friendly_list = ", ".join(sorted(self.state_names.keys()))
                raise ValueError(
                    f"Unknown variable '{node}'. Valid network variables are: {friendly_list}."
                )
            if value is None or str(value).strip() == "":
                continue
            val_str = str(value)
            valid_states = self.state_names[node]
            if val_str not in valid_states:
                # Check if user passed integer string for float-formatted state (e.g. '24' vs '24.0')
                if f"{val_str}.0" in valid_states:
                    val_str = f"{val_str}.0"
                else:
                    friendly_name = FRIENDLY_NODE_NAMES.get(node, node)
                    raise ValueError(
                        f"Invalid value '{value}' for '{friendly_name}' ({node}). "
                        f"Allowed states are: {', '.join(valid_states)}."
                    )
            cleaned[node] = val_str
        return cleaned

    def get_markov_relations(self, node: str) -> Dict[str, List[str]]:
        parents = [str(p) for p in self.model.predecessors(node)]
        children = [str(c) for c in self.model.successors(node)]
        spouses_set = set()
        for child in children:
            for p in self.model.predecessors(child):
                if str(p) != node:
                    spouses_set.add(str(p))
        spouses = sorted(spouses_set)
        blanket = sorted(set(parents) | set(children) | spouses_set)
        return {
            "parents": parents,
            "children": children,
            "spouses": spouses,
            "markov_blanket": blanket,
        }

    def get_graph_metadata(self) -> Dict[str, Any]:
        nodes_payload = []
        for node in self.nodes:
            group = NODE_GROUPS.get(node, "Incident")
            relations = self.get_markov_relations(node)
            prior_map = self.priors[node]
            states_list = []
            for st in self.state_names[node]:
                meta = lookup_registry.get_state_info(node, st)
                states_list.append(
                    {
                        "state": st,
                        "label": meta["label"],
                        "code": meta["code"],
                        "tooltip": meta["tooltip"],
                        "prior": round(prior_map.get(st, 0.0), 6),
                    }
                )
            entropy_info = compute_entropy_metrics(
                [prior_map[s] for s in self.state_names[node]]
            )
            nodes_payload.append(
                {
                    "id": node,
                    "friendly_name": FRIENDLY_NODE_NAMES.get(node, node),
                    "description": NODE_DESCRIPTIONS.get(node, ""),
                    "group": group,
                    "color": GROUP_COLORS.get(group, "#64748b"),
                    "states": states_list,
                    "supports_unknown_state": "Unknown" in self.state_names[node],
                    "parents": relations["parents"],
                    "children": relations["children"],
                    "spouses": relations["spouses"],
                    "markov_blanket": relations["markov_blanket"],
                    "prior_entropy": entropy_info,
                }
            )

        edges_payload = []
        for u, v in self.edges:
            key = f"{u}->{v}"
            edges_payload.append(
                {
                    "id": key,
                    "source": u,
                    "target": v,
                    "source_friendly": FRIENDLY_NODE_NAMES.get(u, u),
                    "target_friendly": FRIENDLY_NODE_NAMES.get(v, v),
                    "description": EDGE_DESCRIPTIONS.get(
                        key,
                        f"Probabilistic dependency from {FRIENDLY_NODE_NAMES.get(u, u)} to {FRIENDLY_NODE_NAMES.get(v, v)}.",
                    ),
                }
            )

        groups_payload = [
            {"name": gname, "color": gcolor}
            for gname, gcolor in GROUP_COLORS.items()
        ]

        return {
            "node_count": len(nodes_payload),
            "edge_count": len(edges_payload),
            "is_dag": self.is_dag(),
            "nodes": nodes_payload,
            "edges": edges_payload,
            "groups": groups_payload,
            "notice": PERSISTENT_NOTICE,
        }

    def _cpd_probability(self, node: str, assignment: Dict[str, str]) -> float:
        cpd = self.cpds[node]
        indices = tuple(
            self.state_indices[var][assignment[var]]
            for var in cpd.variables
        )
        return float(cpd.values[indices])

    def _sample_variable_gibbs(self, node: str, assignment: Dict[str, str]) -> str:
        candidates = self.state_names[node]
        weights = []
        children = list(self.model.successors(node))

        for candidate in candidates:
            assignment[node] = candidate
            prob = self._cpd_probability(node, assignment)
            for child in children:
                prob *= self._cpd_probability(child, assignment)
            weights.append(prob)

        weights_arr = np.asarray(weights, dtype=float)
        total = weights_arr.sum()
        if not np.isfinite(weights_arr).all() or total <= 0:
            # Uniform fallback only if numerical underflow occurs on zero-prob branch
            return random.choice(candidates)

        weights_arr /= total
        return random.choices(candidates, weights=weights_arr.tolist(), k=1)[0]

    def _initialize_gibbs_state(
        self, evidence: Dict[str, str], max_attempts: int = 10000
    ) -> Dict[str, str]:
        """
        Reuses the exact rejection-initialized topological sampler from gibbs_inference.py.py.
        Falls back to clamped forward sampling only if high-dimensional rare evidence
        exceeds max_attempts.
        """
        for _ in range(max_attempts):
            candidate_assignment: Dict[str, str] = {}
            for node in self.topological_order:
                weights = []
                for state in self.state_names[node]:
                    candidate_assignment[node] = state
                    weights.append(self._cpd_probability(node, candidate_assignment))
                weights_arr = np.asarray(weights, dtype=float)
                if not np.isfinite(weights_arr).all() or weights_arr.sum() <= 0:
                    break
                weights_arr /= weights_arr.sum()
                candidate_assignment[node] = random.choices(
                    self.state_names[node], weights=weights_arr.tolist(), k=1
                )[0]
            else:
                if all(candidate_assignment[k] == v for k, v in evidence.items()):
                    return candidate_assignment

        # Clamped topological fallback for multi-node rare evidence
        clamped: Dict[str, str] = dict(evidence)
        for node in self.topological_order:
            if node in clamped:
                continue
            weights = []
            for state in self.state_names[node]:
                clamped[node] = state
                weights.append(self._cpd_probability(node, clamped))
            weights_arr = np.asarray(weights, dtype=float)
            if np.isfinite(weights_arr).all() and weights_arr.sum() > 0:
                weights_arr /= weights_arr.sum()
                clamped[node] = random.choices(
                    self.state_names[node], weights=weights_arr.tolist(), k=1
                )[0]
            else:
                clamped[node] = self.state_names[node][0]
        return clamped

    def run_gibbs_sampling(
        self,
        evidence: Dict[str, str],
        n_samples: int = 5000,
        burn_in: Optional[int] = None,
        seed: int = 42,
    ) -> Dict[str, Dict[str, float]]:
        """
        Run actual Gibbs sampling reusing the exact algorithm and seed from gibbs_inference.py.py.
        Returns posterior distributions for all variables in the network.
        """
        n_samples = max(100, min(int(n_samples), 25000))
        if burn_in is None:
            burn_in = 500 if n_samples == 5000 else max(50, int(n_samples * 0.1))

        total_iterations = n_samples + burn_in

        random.seed(seed)
        np.random.seed(seed)

        assignment = self._initialize_gibbs_state(evidence)
        free_variables = [node for node in self.nodes if node not in evidence]

        counts: Dict[str, Dict[str, int]] = {
            node: {st: 0 for st in self.state_names[node]} for node in self.nodes
        }

        for iteration in range(total_iterations):
            for node in free_variables:
                assignment[node] = self._sample_variable_gibbs(node, assignment)

            if iteration >= burn_in:
                for node in self.nodes:
                    counts[node][assignment[node]] += 1

        gibbs_posteriors: Dict[str, Dict[str, float]] = {}
        for node in self.nodes:
            if node in evidence:
                ev_state = evidence[node]
                gibbs_posteriors[node] = {
                    st: (1.0 if st == ev_state else 0.0) for st in self.state_names[node]
                }
            else:
                gibbs_posteriors[node] = {
                    st: counts[node][st] / float(n_samples)
                    for st in self.state_names[node]
                }

        return gibbs_posteriors

    def run_exact_inference(
        self, evidence: Dict[str, str], target_nodes: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, float]]:
        """Compute exact posterior probabilities using pgmpy VariableElimination."""
        nodes_to_query = target_nodes if target_nodes is not None else self.nodes
        exact_posteriors: Dict[str, Dict[str, float]] = {}

        if not evidence:
            for node in nodes_to_query:
                exact_posteriors[node] = dict(self.priors[node])
            return exact_posteriors

        for node in nodes_to_query:
            if node in evidence:
                ev_val = evidence[node]
                exact_posteriors[node] = {
                    st: (1.0 if st == ev_val else 0.0) for st in self.state_names[node]
                }
            else:
                res = self.inference.query(
                    variables=[node], evidence=evidence, show_progress=False
                )
                states = res.state_names[node]
                vals = res.values
                exact_posteriors[node] = {
                    str(s): float(v) for s, v in zip(states, vals)
                }
        return exact_posteriors

    def infer(
        self,
        evidence: Optional[Dict[str, str]] = None,
        query_vars: Optional[List[str]] = None,
        method: str = "exact",
        samples: int = 5000,
        seed: int = 42,
    ) -> Dict[str, Any]:
        cleaned_evidence = self.validate_evidence(evidence)
        if query_vars:
            for q in query_vars:
                if q not in self.state_names:
                    raise ValueError(f"Unknown query variable '{q}'.")
        else:
            query_vars = ["attempt_completed", "entry_method", "property_loss"]

        method_norm = method.lower().strip()
        if method_norm not in ("exact", "gibbs", "both"):
            raise ValueError("Inference method must be 'exact', 'gibbs', or 'both'.")

        # Always compute exact posteriors so we can compare Exact vs Gibbs when Gibbs is requested
        exact_all = self.run_exact_inference(cleaned_evidence)
        gibbs_all: Optional[Dict[str, Dict[str, float]]] = None

        if method_norm in ("gibbs", "both"):
            gibbs_all = self.run_gibbs_sampling(
                cleaned_evidence, n_samples=samples, seed=seed
            )

        active_posteriors = gibbs_all if (method_norm == "gibbs" and gibbs_all) else exact_all

        node_results: Dict[str, Any] = {}
        for node in self.nodes:
            post_map = active_posteriors[node]
            exact_map = exact_all[node]
            prior_map = self.priors[node]
            is_evidence = node in cleaned_evidence

            state_items = []
            for st in self.state_names[node]:
                meta = lookup_registry.get_state_info(node, st)
                post_val = post_map[st]
                prior_val = prior_map[st]
                delta_val = post_val - prior_val
                item: Dict[str, Any] = {
                    "state": st,
                    "label": meta["label"],
                    "code": meta["code"],
                    "tooltip": meta["tooltip"],
                    "posterior": round(post_val, 6),
                    "prior": round(prior_val, 6),
                    "delta": round(delta_val, 6),
                    "exact_posterior": round(exact_map[st], 6),
                }
                if gibbs_all is not None:
                    g_val = gibbs_all[node][st]
                    item["gibbs_posterior"] = round(g_val, 6)
                    item["abs_error"] = round(abs(exact_map[st] - g_val), 6)
                state_items.append(item)

            # Find top state
            top_item = max(state_items, key=lambda x: x["posterior"])
            entropy_info = (
                {"entropy_bits": 0.0, "max_entropy_bits": 0.0, "normalized_entropy": 0.0, "uncertainty_level": "Observed (Evidence)"}
                if is_evidence
                else compute_entropy_metrics([post_map[s] for s in self.state_names[node]])
            )

            node_results[node] = {
                "node": node,
                "friendly_name": FRIENDLY_NODE_NAMES.get(node, node),
                "group": NODE_GROUPS.get(node, "Incident"),
                "is_evidence": is_evidence,
                "evidence_state": cleaned_evidence.get(node),
                "evidence_label": (
                    lookup_registry.get_state_info(node, cleaned_evidence[node])["label"]
                    if is_evidence
                    else None
                ),
                "top_state": top_item,
                "states": state_items,
                "entropy": entropy_info,
            }

        # Build dedicated comparison summary for the selected query_vars
        comparisons: Dict[str, Any] = {}
        for qvar in query_vars:
            comparisons[qvar] = node_results[qvar]

        return {
            "method": method_norm,
            "samples": samples if method_norm in ("gibbs", "both") else None,
            "burn_in": (500 if samples == 5000 else max(50, int(samples * 0.1)))
            if method_norm in ("gibbs", "both")
            else None,
            "evidence": cleaned_evidence,
            "query_vars": query_vars,
            "nodes": node_results,
            "query_results": comparisons,
            "notice": PERSISTENT_NOTICE,
        }

    def compute_sensitivity(
        self,
        query_var: str = "attempt_completed",
        evidence: Optional[Dict[str, str]] = None,
        top_k: int = 8,
    ) -> Dict[str, Any]:
        """
        "What would change the answer most?" helper:
        Ranks unobserved nodes by how much observing them would shift the query variable's posterior
        (using Expected KL Divergence / Mutual Information and Maximum Posterior Shift).
        """
        cleaned_evidence = self.validate_evidence(evidence)
        if query_var not in self.state_names:
            raise ValueError(f"Unknown query variable '{query_var}'.")

        base_posteriors = self.run_exact_inference(cleaned_evidence)
        q_states = self.state_names[query_var]
        q_base_probs = [base_posteriors[query_var][s] for s in q_states]
        q_base_entropy = compute_entropy_metrics(q_base_probs)

        unobserved = [
            n for n in self.nodes if n not in cleaned_evidence and n != query_var
        ]

        rankings = []
        for cand_node in unobserved:
            cand_states = self.state_names[cand_node]
            cand_marginal = base_posteriors[cand_node]

            expected_kl = 0.0
            expected_entropy = 0.0
            max_shift = 0.0
            most_impactful_state: Optional[Dict[str, Any]] = None

            for st in cand_states:
                p_st = cand_marginal.get(st, 0.0)
                if p_st <= 1e-6:
                    continue
                hyp_ev = dict(cleaned_evidence)
                hyp_ev[cand_node] = st
                res = self.inference.query(
                    variables=[query_var], evidence=hyp_ev, show_progress=False
                )
                r_states = res.state_names[query_var]
                r_map = {str(s): float(v) for s, v in zip(r_states, res.values)}
                q_hyp_probs = [r_map[s] for s in q_states]

                kl = compute_kl_divergence(q_hyp_probs, q_base_probs)
                hyp_ent = compute_entropy_metrics(q_hyp_probs)["entropy_bits"]
                expected_kl += p_st * kl
                expected_entropy += p_st * hyp_ent

                # Max absolute probability shift on any state of query_var
                diffs = [abs(q_hyp_probs[i] - q_base_probs[i]) for i in range(len(q_states))]
                peak_idx = int(np.argmax(diffs))
                shift = diffs[peak_idx]
                if shift >= max_shift:
                    max_shift = shift
                    st_meta = lookup_registry.get_state_info(cand_node, st)
                    q_st_meta = lookup_registry.get_state_info(query_var, q_states[peak_idx])
                    most_impactful_state = {
                        "candidate_state": st,
                        "candidate_state_label": st_meta["label"],
                        "affected_query_state": q_states[peak_idx],
                        "affected_query_state_label": q_st_meta["label"],
                        "base_prob": round(q_base_probs[peak_idx], 4),
                        "new_prob": round(q_hyp_probs[peak_idx], 4),
                        "max_prob_shift": round(shift, 4),
                        "kl_bits": round(kl, 5),
                    }

            entropy_reduction = max(0.0, q_base_entropy["entropy_bits"] - expected_entropy)
            rankings.append(
                {
                    "node": cand_node,
                    "friendly_name": FRIENDLY_NODE_NAMES.get(cand_node, cand_node),
                    "group": NODE_GROUPS.get(cand_node, "Incident"),
                    "expected_kl_bits": round(expected_kl, 5),
                    "entropy_reduction_bits": round(entropy_reduction, 5),
                    "max_posterior_shift": round(max_shift, 4),
                    "most_impactful_observation": most_impactful_state,
                    "explanation": (
                        f"Observing {FRIENDLY_NODE_NAMES.get(cand_node, cand_node)} "
                        f"(especially '{most_impactful_state['candidate_state_label']}') "
                        f"can shift {FRIENDLY_NODE_NAMES.get(query_var, query_var)} by up to "
                        f"{max_shift * 100:.1f} percentage points."
                        if most_impactful_state
                        else f"Minimal impact on {FRIENDLY_NODE_NAMES.get(query_var, query_var)}."
                    ),
                }
            )

        # Sort primarily by expected_kl_bits + max_posterior_shift so both high average & high peak leverage surface
        rankings.sort(
            key=lambda x: (round(x["expected_kl_bits"], 6), round(x["max_posterior_shift"], 6)),
            reverse=True,
        )

        return {
            "query_var": query_var,
            "query_friendly_name": FRIENDLY_NODE_NAMES.get(query_var, query_var),
            "base_entropy": q_base_entropy,
            "rankings": rankings[:top_k],
            "notice": PERSISTENT_NOTICE,
        }

    def compare_scenarios(
        self,
        scenarios: List[Dict[str, Any]],
        query_var: str = "attempt_completed",
    ) -> Dict[str, Any]:
        """Compare 2-4 candidate scenarios side-by-side on a target query variable."""
        if not scenarios or len(scenarios) < 2 or len(scenarios) > 4:
            raise ValueError("Please provide between 2 and 4 candidate scenarios to compare.")
        if query_var not in self.state_names:
            raise ValueError(f"Unknown query variable '{query_var}'.")

        q_states = self.state_names[query_var]
        q_friendly = FRIENDLY_NODE_NAMES.get(query_var, query_var)
        prior_map = self.priors[query_var]

        evaluated = []
        for idx, scen in enumerate(scenarios):
            name = str(scen.get("name") or f"Scenario {idx + 1}").strip()
            raw_ev = scen.get("evidence") or {}
            clean_ev = self.validate_evidence(raw_ev)

            post = self.run_exact_inference(clean_ev, target_nodes=[query_var])[query_var]
            probs_list = [post[s] for s in q_states]
            ent = compute_entropy_metrics(probs_list)

            # Also compute joint probability of the evidence P(E) to measure how typical/plausible the evidence configuration is in historical data
            evidence_log_likelihood = 0.0
            try:
                # Chain rule approximation over evidence nodes or marginal query when small
                ev_prob = 1.0
                conditioned: Dict[str, str] = {}
                for node in self.topological_order:
                    if node in clean_ev:
                        if not conditioned:
                            p_val = self.priors[node].get(clean_ev[node], 1e-6)
                        else:
                            res_ev = self.inference.query(
                                variables=[node], evidence=conditioned, show_progress=False
                            )
                            st_list = [str(s) for s in res_ev.state_names[node]]
                            rmap = dict(zip(st_list, res_ev.values))
                            p_val = float(rmap.get(clean_ev[node], 1e-6))
                        ev_prob *= max(p_val, 1e-9)
                        conditioned[node] = clean_ev[node]
                evidence_prior_prob = float(ev_prob)
                evidence_log_likelihood = float(math.log10(max(ev_prob, 1e-12)))
            except Exception:
                evidence_prior_prob = 0.0
                evidence_log_likelihood = -12.0

            state_breakdown = []
            for st in q_states:
                meta = lookup_registry.get_state_info(query_var, st)
                state_breakdown.append(
                    {
                        "state": st,
                        "label": meta["label"],
                        "code": meta["code"],
                        "posterior": round(post[st], 6),
                        "prior": round(prior_map[st], 6),
                        "delta": round(post[st] - prior_map[st], 6),
                    }
                )

            top_st = max(state_breakdown, key=lambda x: x["posterior"])
            readable_ev = [
                {
                    "node": k,
                    "friendly_name": FRIENDLY_NODE_NAMES.get(k, k),
                    "state": v,
                    "state_label": lookup_registry.get_state_info(k, v)["label"],
                }
                for k, v in clean_ev.items()
            ]

            evaluated.append(
                {
                    "name": name,
                    "evidence": clean_ev,
                    "readable_evidence": readable_ev,
                    "states": state_breakdown,
                    "top_state": top_st,
                    "entropy": ent,
                    "evidence_prior_prob": round(evidence_prior_prob, 6),
                    "evidence_log10_prob": round(evidence_log_likelihood, 3),
                }
            )

        # Plain-English summary of which scenario has lower uncertainty / stronger signal and higher historical support
        lowest_entropy_scen = min(evaluated, key=lambda s: s["entropy"]["normalized_entropy"])
        highest_conf_scen = max(evaluated, key=lambda s: s["top_state"]["posterior"])
        most_typical_scen = max(evaluated, key=lambda s: s["evidence_prior_prob"])

        summary_lines = [
            f"Comparing {len(evaluated)} candidate scenarios on '{q_friendly}':",
            f"• Strongest directional estimate: '{highest_conf_scen['name']}' favors "
            f"'{highest_conf_scen['top_state']['label']}' at {highest_conf_scen['top_state']['posterior'] * 100:.1f}% "
            f"(uncertainty: {highest_conf_scen['entropy']['uncertainty_level']}, H = {highest_conf_scen['entropy']['entropy_bits']:.2f} bits).",
            f"• Lowest posterior uncertainty: '{lowest_entropy_scen['name']}' "
            f"(normalized entropy {lowest_entropy_scen['entropy']['normalized_entropy'] * 100:.1f}%).",
            f"• Highest historical evidence frequency: '{most_typical_scen['name']}' "
            f"(joint prior frequency P(E) = {most_typical_scen['evidence_prior_prob'] * 100:.2f}% in historical NIBRS records).",
        ]

        return {
            "query_var": query_var,
            "query_friendly_name": q_friendly,
            "scenarios": evaluated,
            "summary": " ".join(summary_lines),
            "summary_points": summary_lines,
            "notice": PERSISTENT_NOTICE,
        }

    def get_cpd_table(self, node: str) -> Dict[str, Any]:
        """Return the real learned Conditional Probability Distribution (CPD) table for a node."""
        if node not in self.cpds:
            raise ValueError(f"Unknown variable '{node}'.")

        cpd = self.cpds[node]
        variables = list(cpd.variables)
        target_states = [str(s) for s in cpd.state_names[node]]
        parents = variables[1:]

        target_state_meta = [
            {
                "state": st,
                "label": lookup_registry.get_state_info(node, st)["label"],
            }
            for st in target_states
        ]

        if not parents:
            # Root node (1D CPD)
            vals = cpd.values.flatten().tolist()
            columns = [
                {
                    "column_key": "Prior",
                    "parent_states": {},
                    "parent_labels": "Unconditional Prior P(" + FRIENDLY_NODE_NAMES.get(node, node) + ")",
                    "probabilities": {
                        st: round(float(v), 6) for st, v in zip(target_states, vals)
                    },
                }
            ]
            return {
                "node": node,
                "friendly_name": FRIENDLY_NODE_NAMES.get(node, node),
                "parents": [],
                "parent_friendly_names": [],
                "states": target_state_meta,
                "total_columns": 1,
                "columns": columns,
            }

        # Multi-dimensional CPD: reshape into (n_target_states, n_parent_combinations)
        import itertools

        parent_state_lists = [[str(s) for s in cpd.state_names[p]] for p in parents]
        combinations = list(itertools.product(*parent_state_lists))
        flat_matrix = cpd.values.reshape(len(target_states), -1)

        columns = []
        for col_idx, combo in enumerate(combinations):
            parent_dict = {parents[i]: combo[i] for i in range(len(parents))}
            label_parts = []
            for p_var, p_val in parent_dict.items():
                p_lbl = lookup_registry.get_state_info(p_var, p_val)["label"]
                label_parts.append(f"{FRIENDLY_NODE_NAMES.get(p_var, p_var)} = {p_lbl} ({p_val})")
            probs = {
                target_states[row_idx]: round(float(flat_matrix[row_idx, col_idx]), 6)
                for row_idx in range(len(target_states))
            }
            columns.append(
                {
                    "column_key": " | ".join(f"{k}={v}" for k, v in parent_dict.items()),
                    "parent_states": parent_dict,
                    "parent_labels": ", ".join(label_parts),
                    "probabilities": probs,
                }
            )

        return {
            "node": node,
            "friendly_name": FRIENDLY_NODE_NAMES.get(node, node),
            "parents": parents,
            "parent_friendly_names": [FRIENDLY_NODE_NAMES.get(p, p) for p in parents],
            "states": target_state_meta,
            "total_columns": len(columns),
            "columns": columns,
        }

    def get_preset_scenarios(self) -> List[Dict[str, Any]]:
        """Return the exact 5 preset scenarios from scenario_inference.py.py."""
        return [
            {
                "id": "scenario_1_night_forced",
                "name": "Scenario 1: Night + Forced Entry",
                "description": "Given Night (00:00–05:59) and Forced Entry (F), estimate whether the burglary was Attempted or Completed.",
                "evidence": {"time_period": "Night", "entry_method": "F"},
                "query_var": "attempt_completed",
                "source": "scenario_inference.py.py (Scenario 1)",
            },
            {
                "id": "scenario_2_afternoon_nonforced",
                "name": "Scenario 2: Afternoon + Non-Forced Entry",
                "description": "Given Afternoon (12:00–17:59) and Non-Forced Entry (N), estimate whether the burglary was Attempted or Completed.",
                "evidence": {"time_period": "Afternoon", "entry_method": "N"},
                "query_var": "attempt_completed",
                "source": "scenario_inference.py.py (Scenario 2)",
            },
            {
                "id": "scenario_3_forced_completed_loss",
                "name": "Scenario 3: Forced Entry + Completed Burglary",
                "description": "Given Forced Entry (F) and Completed Burglary (C), estimate the expected Property Loss category.",
                "evidence": {"entry_method": "F", "attempt_completed": "C"},
                "query_var": "property_loss",
                "source": "scenario_inference.py.py (Scenario 3)",
            },
            {
                "id": "scenario_4_night_forced_victim",
                "name": "Scenario 4: Night + Forced Entry (Victim Age)",
                "description": "Given Night (00:00–05:59) and Forced Entry (F), estimate the probable Victim Age Group distribution.",
                "evidence": {"time_period": "Night", "entry_method": "F"},
                "query_var": "victim_age_group",
                "source": "scenario_inference.py.py (Scenario 4)",
            },
            {
                "id": "scenario_5_completed_forced_offender",
                "name": "Scenario 5: Completed + Forced Entry (Offender Profile)",
                "description": "Given Completed Burglary (C) and Forced Entry (F), estimate probable Offender Age Group and Sex.",
                "evidence": {"attempt_completed": "C", "entry_method": "F"},
                "query_var": "offender_age_group",
                "source": "scenario_inference.py.py (Scenario 5)",
            },
        ]


bn_engine = BayesianNetworkEngine()
