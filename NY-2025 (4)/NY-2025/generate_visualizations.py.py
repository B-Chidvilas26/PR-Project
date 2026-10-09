
# ============================================================
# FINAL VISUALIZATION PIPELINE
# Bayesian Network + Exact/Gibbs Inference + HMM
# ============================================================

from pathlib import Path
import pickle
import random
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import networkx as nx

from pgmpy.inference import VariableElimination

warnings.filterwarnings("ignore", category=FutureWarning)

# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "final_visualizations"
OUTPUT_DIR.mkdir(exist_ok=True)

BN_DATA_FILE = BASE_DIR / "burglary_bn_dataset.csv"
HMM_DATA_FILE = BASE_DIR / "burglary_hmm_dataset.csv"
HMM_STATES_FILE = BASE_DIR / "burglary_hmm_states.csv"
BN_MODEL_FILE = BASE_DIR / "burglary_bn_model.pkl"

DPI = 300
RANDOM_SEED = 42

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

plt.rcParams.update({
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.titlesize": 15,
    "axes.labelsize": 11,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "font.family": "DejaVu Sans",
    "savefig.facecolor": "white",
})

print("=" * 65)
print("FINAL BURGLARY ANALYSIS VISUALIZATIONS")
print("=" * 65)

# ============================================================
# LOAD EXISTING DATA
# ============================================================

print("\nLoading existing datasets and trained model...")

required_files = [
    BN_DATA_FILE,
    HMM_DATA_FILE,
    HMM_STATES_FILE,
    BN_MODEL_FILE,
]

missing_files = [str(p) for p in required_files if not p.exists()]

if missing_files:
    raise FileNotFoundError(
        "Required project files are missing:\n"
        + "\n".join(missing_files)
    )

bn_data = pd.read_csv(BN_DATA_FILE)
hmm_data = pd.read_csv(HMM_DATA_FILE)
hmm_states = pd.read_csv(HMM_STATES_FILE)

with open(BN_MODEL_FILE, "rb") as f:
    bn_model = pickle.load(f)

print(f"BN dataset: {bn_data.shape[0]:,} rows")
print(f"BN model: {len(bn_model.nodes())} nodes, "
      f"{len(bn_model.edges())} edges")
print(f"HMM observations: {len(hmm_data)}")
print(f"Output folder: {OUTPUT_DIR}")

def save_figure(fig, filename):
    path = OUTPUT_DIR / filename
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {path.name}")


# ============================================================
# 1. STRUCTURED BAYESIAN NETWORK ARCHITECTURE
# ============================================================

print("\n[1/8] Creating Bayesian Network architecture...")

G = nx.DiGraph()
G.add_nodes_from(bn_model.nodes())
G.add_edges_from(bn_model.edges())

# Assign each node to a layer using its longest-path depth.
# This gives the graph a structured, left-to-right DAG layout.
depth = {}

for node in nx.topological_sort(G):
    parents = list(G.predecessors(node))
    depth[node] = (
        0 if not parents
        else 1 + max(depth[parent] for parent in parents)
    )

layers = {}

for node, layer in depth.items():
    layers.setdefault(layer, []).append(node)

# Stable ordering makes repeated runs produce a consistent layout.
for layer in layers.values():
    layer.sort(key=str)

positions = {}

for layer_number, nodes in layers.items():
    count = len(nodes)

    for index, node in enumerate(nodes):
        positions[node] = (
            layer_number,
            (count - 1) / 2 - index
        )

fig, ax = plt.subplots(figsize=(24, 15))

nx.draw_networkx_nodes(
    G, positions,
    node_size=2600,
    node_color="#DCEAF7",
    edgecolors="#24476B",
    linewidths=1.5,
    ax=ax,
)

nx.draw_networkx_labels(
    G, positions,
    labels={n: str(n).replace("_", "\n") for n in G.nodes()},
    font_size=7.5,
    font_weight="medium",
    ax=ax,
)

nx.draw_networkx_edges(
    G, positions,
    arrows=True,
    arrowstyle="-|>",
    arrowsize=22,
    width=1.6,
    edge_color="#46566B",
    connectionstyle="arc3,rad=0.04",
    min_source_margin=20,
    min_target_margin=25,
    ax=ax,
)

ax.set_title(
    "Bayesian Network Architecture for Burglary Analysis",
    fontsize=21,
    fontweight="bold",
    pad=22,
)

ax.text(
    0.5, 1.01,
    f"{len(G.nodes())} variables | {len(G.edges())} directed dependencies",
    transform=ax.transAxes,
    ha="center",
    fontsize=12,
)

ax.axis("off")
save_figure(fig, "01_bayesian_network.png")


# ============================================================
# 2. BN DATA PREPROCESSING: MISSING VALUES
# ============================================================

print("[2/8] Creating missing-value analysis...")

missing_count = bn_data.isna().sum()
missing_pct = 100 * missing_count / max(len(bn_data), 1)

missing_summary = pd.DataFrame({
    "Missing values": missing_count,
    "Missing percentage": missing_pct,
})

missing_summary = missing_summary[
    missing_summary["Missing values"] > 0
].sort_values("Missing percentage", ascending=True)

fig, ax = plt.subplots(figsize=(12, 7))

if missing_summary.empty:
    ax.text(
        0.5, 0.5,
        "No explicit missing values found in the prepared dataset",
        ha="center", va="center",
        fontsize=14,
        transform=ax.transAxes,
    )
    ax.set_axis_off()
else:
    bars = ax.barh(
        missing_summary.index.astype(str),
        missing_summary["Missing percentage"],
        color="#4477AA",
    )

    ax.set_xlabel("Missing values (%)")
    ax.set_ylabel("Dataset variable")
    ax.set_title(
        "Missing-Value Analysis Before Bayesian Network Modelling",
        fontweight="bold",
    )
    ax.grid(axis="x", linestyle="--", alpha=0.25)

    for bar, value in zip(
        bars, missing_summary["Missing percentage"]
    ):
        ax.text(
            bar.get_width(),
            bar.get_y() + bar.get_height() / 2,
            f" {value:.1f}%",
            va="center",
            fontsize=9,
        )

save_figure(fig, "02_missing_values.png")


# ============================================================
# 3. BN DATA PREPROCESSING: VARIABLE DISTRIBUTIONS
# ============================================================

print("[3/8] Creating variable distribution charts...")

distribution_variables = [
    "time_period",
    "entry_method",
    "attempt_completed",
    "location",
]

available_variables = [
    col for col in distribution_variables
    if col in bn_data.columns
]

if not available_variables:
    print("No selected distribution columns found; skipping chart 3.")
else:
    fig, axes = plt.subplots(
        len(available_variables), 1,
        figsize=(13, 4 * len(available_variables)),
    )

    axes = np.atleast_1d(axes)

    for ax, column in zip(axes, available_variables):
        counts = (
            bn_data[column]
            .fillna("Missing")
            .astype(str)
            .value_counts()
            .head(12)
            .sort_values()
        )

        ax.barh(
            counts.index,
            counts.values,
            color="#4C956C",
        )

        ax.set_title(
            f"Distribution of {column.replace('_', ' ').title()}",
            fontweight="bold",
        )
        ax.set_xlabel("Number of records")
        ax.grid(axis="x", linestyle="--", alpha=0.25)

    fig.suptitle(
        "Prepared Bayesian Network Dataset: Variable Distributions",
        fontsize=18,
        fontweight="bold",
    )
    fig.tight_layout(rect=[0, 0, 1, 0.97])

    save_figure(fig, "03_variable_distributions.png")


# ============================================================
# 4. EXACT INFERENCE VS GIBBS SAMPLING
# ============================================================

print("[4/8] Comparing exact inference and Gibbs sampling...")

EVIDENCE = {
    "time_period": "Night",
    "entry_method": "F",
}

N_SAMPLES = 5000
BURN_IN = 500
TOTAL_ITERATIONS = N_SAMPLES + BURN_IN

# ----- Exact inference -----

exact_engine = VariableElimination(bn_model)

exact_result = exact_engine.query(
    variables=["attempt_completed"],
    evidence=EVIDENCE,
    show_progress=False,
)

target_cpd = bn_model.get_cpds("attempt_completed")
outcome_states = list(
    exact_result.state_names["attempt_completed"]
)

if not all(s in outcome_states for s in ["A", "C"]):
    raise ValueError(
        "Expected outcome states A and C were not found: "
        f"{outcome_states}"
    )

exact_probs = {
    state: float(exact_result.values[outcome_states.index(state)])
    for state in ["A", "C"]
}

# ----- Actual Gibbs sampling -----

cpds = {
    node: bn_model.get_cpds(node)
    for node in bn_model.nodes()
}

variables = list(bn_model.nodes())

state_names = {
    node: list(cpds[node].state_names[node])
    for node in variables
}

state_indices = {
    node: {state: i for i, state in enumerate(state_names[node])}
    for node in variables
}

for node, value in EVIDENCE.items():
    if value not in state_indices[node]:
        raise ValueError(
            f"Invalid evidence {node}={value}. "
            f"Valid states: {state_names[node]}"
        )

def cpd_probability(node, assignment):
    cpd = cpds[node]
    indices = tuple(
        state_indices[var][assignment[var]]
        for var in cpd.variables
    )
    return float(cpd.values[indices])

def sample_variable(node, assignment):
    candidates = state_names[node]
    weights = []
    children = list(bn_model.successors(node))

    for candidate in candidates:
        assignment[node] = candidate
        probability = cpd_probability(node, assignment)

        for child in children:
            probability *= cpd_probability(child, assignment)

        weights.append(probability)

    weights = np.asarray(weights, dtype=float)

    if (
        not np.isfinite(weights).all()
        or weights.sum() <= 0
    ):
        raise ValueError(
            f"Invalid Gibbs conditional for variable {node}"
        )

    weights /= weights.sum()

    return random.choices(
        candidates,
        weights=weights.tolist(),
        k=1,
    )[0]

def initialize_valid_assignment(max_attempts=10000):
    order = list(nx.topological_sort(bn_model))

    for _ in range(max_attempts):
        assignment = {}

        for node in order:
            weights = []

            for state in state_names[node]:
                assignment[node] = state
                weights.append(cpd_probability(node, assignment))

            weights = np.asarray(weights, dtype=float)

            if (
                not np.isfinite(weights).all()
                or weights.sum() <= 0
            ):
                break

            weights /= weights.sum()

            assignment[node] = random.choices(
                state_names[node],
                weights=weights.tolist(),
                k=1,
            )[0]
        else:
            if all(
                assignment[node] == value
                for node, value in EVIDENCE.items()
            ):
                return assignment

    raise RuntimeError(
        "Could not initialize a valid Gibbs assignment "
        "consistent with the evidence."
    )

random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

assignment = initialize_valid_assignment()

free_variables = [
    node for node in variables
    if node not in EVIDENCE
]

gibbs_counts = {"A": 0, "C": 0}

for iteration in range(TOTAL_ITERATIONS):
    for node in free_variables:
        assignment[node] = sample_variable(node, assignment)

    if iteration >= BURN_IN:
        outcome = assignment["attempt_completed"]
        if outcome in gibbs_counts:
            gibbs_counts[outcome] += 1

gibbs_total = sum(gibbs_counts.values())

if gibbs_total == 0:
    raise RuntimeError("Gibbs sampling returned no valid outcomes.")

gibbs_probs = {
    state: gibbs_counts[state] / gibbs_total
    for state in ["A", "C"]
}

# Save the actual numeric results for reporting.
comparison = pd.DataFrame({
    "Outcome": ["Attempted", "Completed"],
    "Exact probability": [
        exact_probs["A"], exact_probs["C"]
    ],
    "Gibbs probability": [
        gibbs_probs["A"], gibbs_probs["C"]
    ],
})

comparison["Absolute error"] = (
    comparison["Exact probability"]
    - comparison["Gibbs probability"]
).abs()

comparison.to_csv(
    OUTPUT_DIR / "exact_vs_gibbs_results.csv",
    index=False,
)

fig, ax = plt.subplots(figsize=(10, 6))

x = np.arange(len(comparison))
width = 0.34

bars_exact = ax.bar(
    x - width / 2,
    comparison["Exact probability"] * 100,
    width,
    label="Exact inference",
    color="#4477AA",
)

bars_gibbs = ax.bar(
    x + width / 2,
    comparison["Gibbs probability"] * 100,
    width,
    label=f"Gibbs sampling ({N_SAMPLES:,} retained samples)",
    color="#EE9944",
)

ax.set_xticks(x)
ax.set_xticklabels(comparison["Outcome"])
ax.set_ylabel("Estimated probability (%)")
ax.set_ylim(0, 105)
ax.set_title(
    "Exact Inference vs. Gibbs Sampling\n"
    "Evidence: Night + Forced Entry",
    fontweight="bold",
)
ax.legend()
ax.grid(axis="y", linestyle="--", alpha=0.25)

for bars in [bars_exact, bars_gibbs]:
    ax.bar_label(
        bars,
        fmt="%.2f%%",
        padding=3,
        fontsize=10,
    )

fig.tight_layout()
save_figure(fig, "04_exact_vs_gibbs.png")

print("\nExact vs Gibbs results:")
print(comparison.to_string(index=False))


# ============================================================
# 5. BURGLARY OUTCOMES AND ENTRY METHOD
# ============================================================

print("[5/8] Creating burglary outcome chart...")

required_columns = ["attempt_completed", "entry_method"]

if all(col in bn_data.columns for col in required_columns):
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))

    for ax, column, title in [
        (
            axes[0],
            "attempt_completed",
            "Attempted vs Completed",
        ),
        (
            axes[1],
            "entry_method",
            "Entry Method",
        ),
    ]:
        counts = (
            bn_data[column]
            .fillna("Missing")
            .astype(str)
            .value_counts()
        )

        bars = ax.bar(
            counts.index,
            counts.values,
            color=["#4477AA", "#66AA99", "#EE9944", "#AA6677"],
        )

        ax.set_title(title, fontweight="bold")
        ax.set_ylabel("Number of records")
        ax.tick_params(axis="x", rotation=15)
        ax.grid(axis="y", linestyle="--", alpha=0.25)

        ax.bar_label(
            bars,
            labels=[f"{v:,}" for v in counts.values],
            padding=3,
            fontsize=9,
        )

    fig.suptitle(
        "Observed Burglary Outcome and Entry Method",
        fontsize=17,
        fontweight="bold",
    )
    fig.tight_layout(rect=[0, 0, 1, 0.93])

    save_figure(fig, "05_burglary_outcomes.png")
else:
    print("Required outcome columns not found; skipping chart 5.")


# ============================================================
# 6. HMM MONTHLY ACTIVITY
# ============================================================

print("[6/8] Creating monthly activity chart...")

if not all(
    col in hmm_data.columns
    for col in ["incident_month", "time_period", "crime_count"]
):
    raise ValueError(
        "HMM dataset needs incident_month, time_period, crime_count."
    )

pivot = hmm_data.pivot_table(
    index="incident_month",
    columns="time_period",
    values="crime_count",
    aggfunc="sum",
).sort_index()

fig, ax = plt.subplots(figsize=(12, 6))

pivot.plot(
    kind="line",
    marker="o",
    linewidth=2,
    ax=ax,
)

ax.set_title(
    "Monthly Burglary Activity by Time Period",
    fontweight="bold",
)
ax.set_xlabel("Month")
ax.set_ylabel("Observed burglary count")
ax.grid(True, linestyle="--", alpha=0.3)
ax.legend(title="Time period", ncol=2)

fig.tight_layout()
save_figure(fig, "06_hmm_monthly_activity.png")


# ============================================================
# 7. HMM HIDDEN-STATE HEATMAP
# ============================================================

print("[7/8] Creating HMM hidden-state heatmap...")

state_required = [
    "incident_month",
    "time_period",
    "hidden_state",
]

if not all(col in hmm_states.columns for col in state_required):
    raise ValueError(
        "HMM state file must contain: "
        + ", ".join(state_required)
    )

state_labels = {
    0: "Low",
    1: "Medium",
    2: "High",
}

states_for_plot = hmm_states.copy()

states_for_plot["state_label"] = (
    pd.to_numeric(
        states_for_plot["hidden_state"],
        errors="coerce",
    )
    .map(state_labels)
)

state_order = ["Low", "Medium", "High"]

heatmap_data = states_for_plot.pivot(
    index="incident_month",
    columns="time_period",
    values="state_label",
).sort_index()

# Convert categories to numbers only for plotting.
numeric_map = {
    "Low": 0,
    "Medium": 1,
    "High": 2,
}

numeric_heatmap = heatmap_data.replace(numeric_map)

fig, ax = plt.subplots(figsize=(11, 7))

im = ax.imshow(
    numeric_heatmap.values,
    aspect="auto",
    cmap=plt.matplotlib.colors.ListedColormap(
        ["#8FC1A9", "#F4D35E", "#EE6C4D"]
    ),
    vmin=0,
    vmax=2,
)

ax.set_xticks(np.arange(len(numeric_heatmap.columns)))
ax.set_xticklabels(numeric_heatmap.columns, rotation=25, ha="right")
ax.set_yticks(np.arange(len(numeric_heatmap.index)))
ax.set_yticklabels(numeric_heatmap.index)

ax.set_title(
    "HMM-Inferred Activity States by Month and Time Period",
    fontweight="bold",
)
ax.set_xlabel("Time period")
ax.set_ylabel("Month")

for i in range(numeric_heatmap.shape[0]):
    for j in range(numeric_heatmap.shape[1]):
        value = numeric_heatmap.iloc[i, j]

        if pd.notna(value):
            label = state_labels[int(value)]
            ax.text(
                j, i, label,
                ha="center", va="center",
                fontsize=8,
                color="black",
            )

fig.tight_layout()
save_figure(fig, "07_hmm_state_heatmap.png")


# ============================================================
# 8. HMM TRANSITIONS BETWEEN DECODED STATES
# ============================================================

print("[8/8] Creating HMM state transition matrix...")

# Estimate transitions from the ordered decoded state sequence.
# This is explicitly an empirical decoded-state transition matrix.
sequence = states_for_plot.copy()

period_order = {
    "Morning": 0,
    "Afternoon": 1,
    "Evening": 2,
    "Night": 3,
}

sequence["period_order"] = (
    sequence["time_period"].map(period_order).fillna(99)
)

sequence = sequence.sort_values(
    ["incident_month", "period_order"]
)

sequence["state_number"] = pd.to_numeric(
    sequence["hidden_state"],
    errors="coerce",
)

valid_states = sequence["state_number"].dropna().astype(int).tolist()

transition_counts = np.zeros((3, 3), dtype=float)

for previous, current in zip(valid_states[:-1], valid_states[1:]):
    if previous in (0, 1, 2) and current in (0, 1, 2):
        transition_counts[previous, current] += 1

row_sums = transition_counts.sum(axis=1, keepdims=True)

transition_probs = np.divide(
    transition_counts,
    row_sums,
    out=np.zeros_like(transition_counts),
    where=row_sums != 0,
)

fig, ax = plt.subplots(figsize=(7, 6))

im = ax.imshow(
    transition_probs,
    cmap="Blues",
    vmin=0,
    vmax=1,
)

labels = ["Low", "Medium", "High"]

ax.set_xticks(range(3))
ax.set_xticklabels(labels)
ax.set_yticks(range(3))
ax.set_yticklabels(labels)

ax.set_xlabel("Next decoded state")
ax.set_ylabel("Previous decoded state")
ax.set_title(
    "Empirical Transition Probabilities Between HMM States",
    fontweight="bold",
)

for i in range(3):
    for j in range(3):
        ax.text(
            j, i,
            f"{transition_probs[i, j]:.2f}\n"
            f"(n={int(transition_counts[i, j])})",
            ha="center",
            va="center",
            color="white" if transition_probs[i, j] > 0.55 else "black",
            fontsize=10,
        )

fig.colorbar(im, ax=ax, label="Transition probability")
fig.tight_layout()
save_figure(fig, "08_hmm_transition_matrix.png")


# ============================================================
# FINISHED
# ============================================================

print("\n" + "=" * 65)
print("VISUALIZATION PIPELINE COMPLETE")
print("=" * 65)

print(f"\nOutput folder:\n{OUTPUT_DIR}")
print("\nFiles in output folder:")

for path in sorted(OUTPUT_DIR.iterdir()):
    print(" -", path.name)

print("\nOpen the folder with:")
print("explorer .\\final_visualizations")
