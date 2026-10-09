import joblib
import random
import pandas as pd
import numpy as np
import networkx as nx
from pgmpy.inference import VariableElimination
from pgmpy.sampling import GibbsSampling

print("=" * 70)
print("BURGLARY BAYESIAN NETWORK")
print("EXACT vs APPROXIMATE INFERENCE")
print("=" * 70)

# ============================================================
# LOAD TRAINED MODEL
# ============================================================

print("\nLoading trained Bayesian Network...")

model = joblib.load("burglary_bn_model.pkl")

print("Model loaded successfully.")
print("Number of nodes:", len(model.nodes()))
print("Number of edges:", len(model.edges()))

# ============================================================
# EVIDENCE
# ============================================================

evidence = {
    "time_period": "Night",
    "entry_method": "F"
}

print("\n" + "=" * 70)
print("QUESTION")
print("=" * 70)

print("""
Given:
    Time period = Night
    Entry method = Forced

What is the probability that the burglary
was attempted or completed?
""")

# ============================================================
# EXACT INFERENCE
# ============================================================

print("=" * 70)
print("EXACT INFERENCE")
print("=" * 70)

exact = VariableElimination(model)

exact_result = exact.query(
    variables=["attempt_completed"],
    evidence=evidence,
    show_progress=False
)

# Get state names safely
states = exact_result.state_names["attempt_completed"]

exact_attempted = exact_result.values[
    states.index("A")
]

exact_completed = exact_result.values[
    states.index("C")
]

print(f"Attempted : {exact_attempted:.4f}")
print(f"Completed : {exact_completed:.4f}")

print(f"\nAttempted : {exact_attempted * 100:.2f}%")
print(f"Completed : {exact_completed * 100:.2f}%")

# ============================================================
# APPROXIMATE INFERENCE - GIBBS SAMPLING
# ============================================================


# ============================================================
# APPROXIMATE INFERENCE - ACTUAL GIBBS SAMPLING
# ============================================================

print("\n" + "=" * 70)
print("APPROXIMATE INFERENCE - GIBBS SAMPLING")
print("=" * 70)

N_SAMPLES = 5000
BURN_IN = 500
TOTAL_ITERATIONS = N_SAMPLES + BURN_IN

EVIDENCE = {
    "time_period": "Night",
    "entry_method": "F"
}

print(f"\nSampling iterations : {N_SAMPLES}")
print(f"Burn-in iterations  : {BURN_IN}")
print("Evidence            : Night + Forced")

# ------------------------------------------------------------
# Prepare state names and CPDs
# ------------------------------------------------------------

variables = list(model.nodes())
cpds = {node: model.get_cpds(node) for node in variables}

state_names = {
    node: list(cpds[node].state_names[node])
    for node in variables
}

state_indices = {
    node: {
        state: i for i, state in enumerate(state_names[node])
    }
    for node in variables
}

# Check evidence values
for node, value in EVIDENCE.items():
    if value not in state_indices[node]:
        raise ValueError(
            f"Evidence {node}={value!r} is not a valid state. "
            f"Available states: {state_names[node]}"
        )

# ------------------------------------------------------------
# Conditional probability from a CPD
# ------------------------------------------------------------

def cpd_probability(node, assignment):
    cpd = cpds[node]

    indices = tuple(
        state_indices[var][assignment[var]]
        for var in cpd.variables
    )

    return float(cpd.values[indices])


# ------------------------------------------------------------
# Gibbs conditional for one variable
# ------------------------------------------------------------

def sample_variable(node, assignment):
    candidates = state_names[node]
    weights = []

    children = list(model.successors(node))

    for candidate in candidates:
        assignment[node] = candidate

        # P(node | its parents)
        probability = cpd_probability(node, assignment)

        # Multiply by each child's CPD:
        # P(child | its parents)
        for child in children:
            probability *= cpd_probability(child, assignment)

        weights.append(probability)

    weights = np.asarray(weights, dtype=float)

    if not np.isfinite(weights).all() or weights.sum() <= 0:
        raise ValueError(
            f"Invalid conditional probabilities for {node}"
        )

    weights /= weights.sum()

    return random.choices(
        candidates,
        weights=weights.tolist(),
        k=1
    )[0]



# ------------------------------------------------------------
# Initialize a valid assignment consistent with the evidence
# ------------------------------------------------------------

random.seed(42)
np.random.seed(42)

topological_order = list(nx.topological_sort(model))

def generate_valid_initial_state(max_attempts=10000):

    for _ in range(max_attempts):

        candidate_assignment = {}

        # Generate a valid joint assignment in DAG order
        for node in topological_order:

            weights = []

            for state in state_names[node]:
                candidate_assignment[node] = state

                weights.append(
                    cpd_probability(node, candidate_assignment)
                )

            weights = np.asarray(weights, dtype=float)

            if (
                not np.isfinite(weights).all()
                or weights.sum() <= 0
            ):
                break

            weights /= weights.sum()

            candidate_assignment[node] = random.choices(
                state_names[node],
                weights=weights.tolist(),
                k=1
            )[0]

        else:
            # Keep only samples matching the evidence
            if all(
                candidate_assignment[node] == value
                for node, value in EVIDENCE.items()
            ):
                return candidate_assignment

    raise RuntimeError(
        "Could not initialize a valid state matching the evidence. "
        "Check the model's CPDs and evidence values."
    )


assignment = generate_valid_initial_state()

free_variables = [
    node for node in variables
    if node not in EVIDENCE
]

# ------------------------------------------------------------
# Run Gibbs iterations
# ------------------------------------------------------------

results = []

for iteration in range(TOTAL_ITERATIONS):

    for node in free_variables:
        assignment[node] = sample_variable(node, assignment)

    # Discard burn-in, then record one state per iteration
    if iteration >= BURN_IN:
        results.append(assignment.copy())

    if (iteration + 1) % 100 == 0:
        print(
            f"Completed {iteration + 1}/"
            f"{TOTAL_ITERATIONS} iterations"
        )

samples = pd.DataFrame(results)

# ------------------------------------------------------------
# Estimate probability from the retained Gibbs samples
# ------------------------------------------------------------

counts = samples["attempt_completed"].value_counts()
total = len(samples)

attempted = counts.get("A", 0)
completed = counts.get("C", 0)

gibbs_attempted = attempted / total
gibbs_completed = completed / total

print("\n" + "=" * 70)
print("GIBBS SAMPLING RESULTS")
print("=" * 70)

print(f"Retained samples : {total}")
print(f"Attempted count  : {attempted}")
print(f"Completed count  : {completed}")

print(f"\nAttempted : {gibbs_attempted:.4f} "
      f"({gibbs_attempted * 100:.2f}%)")
print(f"Completed : {gibbs_completed:.4f} "
      f"({gibbs_completed * 100:.2f}%)")

# ------------------------------------------------------------
# Compare with exact inference
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("EXACT vs GIBBS")
print("=" * 70)

print(f"{'Outcome':<15}{'Exact':>12}{'Gibbs':>12}{'Abs. Error':>14}")
print("-" * 53)

print(
    f"{'Attempted':<15}"
    f"{exact_attempted:>12.4f}"
    f"{gibbs_attempted:>12.4f}"
    f"{abs(exact_attempted - gibbs_attempted):>14.4f}"
)

print(
    f"{'Completed':<15}"
    f"{exact_completed:>12.4f}"
    f"{gibbs_completed:>12.4f}"
    f"{abs(exact_completed - gibbs_completed):>14.4f}"
)

print("\nGibbs sampling finished.")
print("Note: estimates can vary due to sampling error and burn-in.")
