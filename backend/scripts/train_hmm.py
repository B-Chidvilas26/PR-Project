import pandas as pd
import numpy as np
import joblib

print("=" * 70)
print("BURGLARY HIDDEN MARKOV MODEL")
print("CUSTOM HMM IMPLEMENTATION")
print("=" * 70)

# ------------------------------------------------------------
# LOAD DATA
# ------------------------------------------------------------

print("\nLoading HMM dataset...")

data = pd.read_csv("burglary_hmm_dataset.csv")

print("Rows:", len(data))

# ------------------------------------------------------------
# CREATE OBSERVATION SEQUENCE
# ------------------------------------------------------------

observations = data["crime_count"].values.astype(float)

print("\nObservation sequence prepared.")

# ------------------------------------------------------------
# NORMALIZE
# ------------------------------------------------------------

mean = observations.mean()
std = observations.std()

scaled = (observations - mean) / std

# ------------------------------------------------------------
# DEFINE HIDDEN STATES
# ------------------------------------------------------------

N_STATES = 3

print("\nNumber of hidden states:", N_STATES)

# ------------------------------------------------------------
# INITIALIZE STATES
# ------------------------------------------------------------

# Divide observations into 3 intensity levels
# 0 = Low
# 1 = Medium
# 2 = High

threshold1 = np.percentile(observations, 33)
threshold2 = np.percentile(observations, 66)

states = np.zeros(len(observations), dtype=int)

states[observations > threshold1] = 1
states[observations > threshold2] = 2

# ------------------------------------------------------------
# STATE STATISTICS
# ------------------------------------------------------------

state_means = []

for state in range(N_STATES):

    values = observations[states == state]

    if len(values) > 0:
        state_means.append(values.mean())
    else:
        state_means.append(0)

state_means = np.array(state_means)

# ------------------------------------------------------------
# TRANSITION MATRIX
# ------------------------------------------------------------

transition = np.zeros((N_STATES, N_STATES))

for i in range(len(states) - 1):

    current_state = states[i]
    next_state = states[i + 1]

    transition[current_state][next_state] += 1

# Normalize rows

for i in range(N_STATES):

    row_sum = transition[i].sum()

    if row_sum > 0:
        transition[i] /= row_sum
    else:
        transition[i] = 1 / N_STATES

# ------------------------------------------------------------
# INITIAL STATE PROBABILITY
# ------------------------------------------------------------

initial_prob = np.zeros(N_STATES)

initial_prob[states[0]] = 1.0

# ------------------------------------------------------------
# DISPLAY RESULTS
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("HIDDEN STATE ANALYSIS")
print("=" * 70)

for state in range(N_STATES):

    count = np.sum(states == state)

    print(
        f"State {state}: "
        f"{count} observations | "
        f"Mean crime count = {state_means[state]:.2f}"
    )

# ------------------------------------------------------------
# TRANSITION MATRIX
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("TRANSITION MATRIX")
print("=" * 70)

print(
    pd.DataFrame(
        transition,
        index=["State 0", "State 1", "State 2"],
        columns=["State 0", "State 1", "State 2"]
    )
)

# ------------------------------------------------------------
# INITIAL PROBABILITIES
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("INITIAL STATE PROBABILITIES")
print("=" * 70)

print(initial_prob)

# ------------------------------------------------------------
# ADD STATES TO DATA
# ------------------------------------------------------------

data["hidden_state"] = states

# ------------------------------------------------------------
# SAVE MODEL
# ------------------------------------------------------------

model_data = {
    "n_states": N_STATES,
    "state_means": state_means,
    "transition_matrix": transition,
    "initial_probability": initial_prob,
    "mean": mean,
    "std": std
}

joblib.dump(
    model_data,
    "burglary_hmm_model.pkl"
)

data.to_csv(
    "burglary_hmm_states.csv",
    index=False
)

# ------------------------------------------------------------
# FINAL
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("FILES SAVED")
print("=" * 70)

print("burglary_hmm_model.pkl")
print("burglary_hmm_states.csv")

print("\nHMM TRAINING COMPLETE")
print("=" * 70)