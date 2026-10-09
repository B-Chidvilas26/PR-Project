import pandas as pd
import numpy as np
import joblib

print("=" * 70)
print("BURGLARY HIDDEN MARKOV MODEL - INFERENCE")
print("=" * 70)

# ------------------------------------------------------------
# LOAD MODEL
# ------------------------------------------------------------

print("\nLoading trained HMM...")

model = joblib.load("burglary_hmm_model.pkl")

transition = model["transition_matrix"]
state_means = model["state_means"]
initial_prob = model["initial_probability"]

print("Model loaded successfully.")

# ------------------------------------------------------------
# LOAD DATA
# ------------------------------------------------------------

data = pd.read_csv("burglary_hmm_states.csv")

print("Rows:", len(data))

# ------------------------------------------------------------
# STATE INTERPRETATION
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("HIDDEN STATES")
print("=" * 70)

state_names = {
    0: "Low Activity",
    1: "Medium Activity",
    2: "High Activity"
}

for state in range(3):
    print(
        f"State {state}: "
        f"{state_names[state]} | "
        f"Mean crime count = {state_means[state]:.2f}"
    )

# ------------------------------------------------------------
# MONTH / TIME-PERIOD STATES
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("MONTHLY HIDDEN STATES")
print("=" * 70)

for month in range(1, 13):

    month_data = data[
        data["incident_month"] == month
    ]

    print(f"\nMonth {month}:")

    for _, row in month_data.iterrows():

        period = row["time_period"]
        count = row["crime_count"]
        state = int(row["hidden_state"])

        print(
            f"  {period:10s} | "
            f"Crime Count: {count:3d} | "
            f"State: {state} ({state_names[state]})"
        )

# ------------------------------------------------------------
# STATE DISTRIBUTION
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("STATE DISTRIBUTION")
print("=" * 70)

distribution = (
    data["hidden_state"]
    .value_counts(normalize=True)
    .sort_index()
)

for state in range(3):

    probability = distribution.get(state, 0)

    print(
        f"State {state} ({state_names[state]}): "
        f"{probability:.4f} "
        f"({probability * 100:.2f}%)"
    )

# ------------------------------------------------------------
# MOST COMMON STATE
# ------------------------------------------------------------

most_common_state = (
    data["hidden_state"]
    .value_counts()
    .idxmax()
)

print("\nMost frequently observed state:")
print(
    f"State {most_common_state} "
    f"({state_names[most_common_state]})"
)

# ------------------------------------------------------------
# NEXT STATE PREDICTION
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("NEXT STATE PREDICTION")
print("=" * 70)

last_state = int(
    data.iloc[-1]["hidden_state"]
)

print(
    f"\nLast observed state: "
    f"State {last_state} ({state_names[last_state]})"
)

next_probabilities = transition[last_state]

print("\nProbability of next state:")

for state in range(3):

    print(
        f"State {state} ({state_names[state]}): "
        f"{next_probabilities[state]:.4f} "
        f"({next_probabilities[state] * 100:.2f}%)"
    )

predicted_state = np.argmax(next_probabilities)

print(
    f"\nPredicted next state: "
    f"State {predicted_state} "
    f"({state_names[predicted_state]})"
)

# ------------------------------------------------------------
# HIGH ACTIVITY ANALYSIS
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("HIGH ACTIVITY PERIODS")
print("=" * 70)

high_activity = data[
    data["hidden_state"] == 2
]

for _, row in high_activity.iterrows():

    print(
        f"Month {int(row['incident_month']):2d} | "
        f"{row['time_period']:10s} | "
        f"Crime Count: {int(row['crime_count'])}"
    )

# ------------------------------------------------------------
# LOW ACTIVITY ANALYSIS
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("LOW ACTIVITY PERIODS")
print("=" * 70)

low_activity = data[
    data["hidden_state"] == 0
]

for _, row in low_activity.iterrows():

    print(
        f"Month {int(row['incident_month']):2d} | "
        f"{row['time_period']:10s} | "
        f"Crime Count: {int(row['crime_count'])}"
    )

# ------------------------------------------------------------
# COMPLETE
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("HMM INFERENCE COMPLETE")
print("=" * 70)