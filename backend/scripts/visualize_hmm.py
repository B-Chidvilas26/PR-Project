import os
import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt


# ============================================================
# SETTINGS
# ============================================================

OUTPUT_DIR = "hmm_visualizations"
os.makedirs(OUTPUT_DIR, exist_ok=True)

DATA_FILE = "burglary_hmm_dataset.csv"
STATE_FILE = "burglary_hmm_states.csv"
MODEL_FILE = "burglary_hmm_model.pkl"


print("=" * 70)
print("HMM VISUALIZATION - BURGLARY ACTIVITY ANALYSIS")
print("=" * 70)


# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading HMM dataset...")

df = pd.read_csv(DATA_FILE)

print(f"Dataset loaded: {len(df)} observations")


# ============================================================
# LOAD HMM STATE RESULTS
# ============================================================

print("Loading hidden-state results...")

states_df = pd.read_csv(STATE_FILE)

print(f"State data loaded: {len(states_df)} observations")


# ============================================================
# LOAD MODEL
# ============================================================

print("Loading trained HMM model...")

model = joblib.load(MODEL_FILE)

print("HMM model loaded successfully.")


# ============================================================
# DISPLAY COLUMN INFORMATION
# ============================================================

print("\nDataset columns:")
print(df.columns.tolist())

print("\nState dataset columns:")
print(states_df.columns.tolist())


# ============================================================
# HELPER: FIND COLUMN
# ============================================================

def find_column(dataframe, possible_names):

    for name in possible_names:
        if name in dataframe.columns:
            return name

    return None


month_col = find_column(
    df,
    ["incident_month", "month", "Month"]
)

period_col = find_column(
    df,
    ["time_period", "period", "Time Period"]
)

count_col = find_column(
    df,
    ["crime_count", "count", "Count", "incident_count"]
)


state_col = find_column(
    states_df,
    ["hidden_state", "state", "Hidden State", "State"]
)


state_name_col = find_column(
    states_df,
    ["state_name", "state_label", "State Name", "State Label"]
)


# ============================================================
# 1. MONTHLY CRIME ACTIVITY
# ============================================================

print("\n[1/5] Creating monthly crime activity visualization...")


# If count column already exists, use it.
# Otherwise calculate counts from rows.
if count_col is not None:

    activity = df.copy()

else:

    activity = (
        df.groupby(
            [month_col, period_col]
        )
        .size()
        .reset_index(name="crime_count")
    )

    count_col = "crime_count"


# Pivot table
pivot = activity.pivot_table(
    index=month_col,
    columns=period_col,
    values=count_col,
    aggfunc="sum",
    fill_value=0
)


# Ensure chronological month order
pivot = pivot.sort_index()


# Desired period order
period_order = [
    "Morning",
    "Afternoon",
    "Evening",
    "Night"
]

available_periods = [
    p for p in period_order
    if p in pivot.columns
]

pivot = pivot[available_periods]


plt.figure(figsize=(12, 7))

for period in available_periods:

    plt.plot(
        pivot.index,
        pivot[period],
        marker="o",
        linewidth=2.5,
        markersize=6,
        label=period
    )


plt.title(
    "Monthly Burglary Activity by Time Period",
    fontsize=19,
    fontweight="bold"
)

plt.xlabel(
    "Month",
    fontsize=12
)

plt.ylabel(
    "Number of Burglary Incidents",
    fontsize=12
)

plt.xticks(
    range(1, 13)
)

plt.grid(
    linestyle="--",
    alpha=0.3
)

plt.legend(
    title="Time Period"
)

plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/01_monthly_crime_activity.png",
    dpi=300,
    bbox_inches="tight"
)

plt.close()

print(
    "Saved: 01_monthly_crime_activity.png"
)


# ============================================================
# 2. HIDDEN STATE TIMELINE
# ============================================================

print("\n[2/5] Creating hidden-state timeline...")


# Sort by month and time period
period_order_dict = {
    "Morning": 0,
    "Afternoon": 1,
    "Evening": 2,
    "Night": 3
}

states_plot = states_df.copy()


if month_col in states_plot.columns:
    states_plot["period_order"] = (
        states_plot[period_col]
        .map(period_order_dict)
        .fillna(99)
    )

    states_plot = states_plot.sort_values(
        [month_col, "period_order"]
    )


# Extract state names
if state_name_col is not None:

    state_names = (
        states_plot[state_name_col]
        .astype(str)
        .tolist()
    )

else:

    state_names = (
        states_plot[state_col]
        .astype(str)
        .tolist()
    )


# Convert state labels to numeric positions
unique_states = []

for state in state_names:

    if state not in unique_states:
        unique_states.append(state)


state_to_number = {
    state: i
    for i, state in enumerate(unique_states)
}


numeric_states = [
    state_to_number[state]
    for state in state_names
]


plt.figure(figsize=(15, 6))

plt.plot(
    range(len(numeric_states)),
    numeric_states,
    marker="o",
    linewidth=2.5,
    markersize=6
)

plt.yticks(
    [0, 1, 2],
    [
        "Low Activity",
        "Medium Activity",
        "High Activity"
    ]
)

plt.xlabel(
    "Sequential Time Period",
    fontsize=12
)

plt.ylabel(
    "HMM Activity State",
    fontsize=12,
    fontweight="bold"
)

plt.title(
    "HMM Hidden-State Timeline of Burglary Activity",
    fontsize=19,
    fontweight="bold"
)

plt.grid(
    linestyle="--",
    alpha=0.3
)

plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/02_hidden_state_timeline.png",
    dpi=300,
    bbox_inches="tight"
)

plt.close()

print(
    "Saved: 02_hidden_state_timeline.png"
)


# ============================================================
# 3. MONTH × TIME PERIOD HIDDEN STATE HEATMAP
# ============================================================

print("\n[3/5] Creating improved hidden-state heatmap...")


# ------------------------------------------------------------
# State names
# ------------------------------------------------------------

STATE_NAMES = {
    0: "Low",
    1: "Medium",
    2: "High"
}


# ------------------------------------------------------------
# Create month × time-period table
# ------------------------------------------------------------

heatmap_data = states_plot.pivot_table(
    index=month_col,
    columns=period_col,
    values=state_col,
    aggfunc="first"
)


# Correct order of time periods
available_heatmap_periods = [
    p for p in period_order
    if p in heatmap_data.columns
]

heatmap_data = heatmap_data[
    available_heatmap_periods
]

heatmap_data = heatmap_data.sort_index()


# Convert to numeric
heat_numeric = heatmap_data.astype(float)


# ------------------------------------------------------------
# Create figure
# ------------------------------------------------------------

fig, ax = plt.subplots(
    figsize=(12, 9)
)


# ------------------------------------------------------------
# Heatmap
# ------------------------------------------------------------

im = ax.imshow(
    heat_numeric.values,
    aspect="auto",
    vmin=0,
    vmax=2
)


# ------------------------------------------------------------
# Axis labels
# ------------------------------------------------------------

ax.set_xticks(
    range(len(heat_numeric.columns))
)

ax.set_xticklabels(
    heat_numeric.columns,
    fontsize=12,
    fontweight="bold"
)


ax.set_yticks(
    range(len(heat_numeric.index))
)

ax.set_yticklabels(
    [
        f"Month {int(x)}"
        for x in heat_numeric.index
    ],
    fontsize=11
)


ax.set_xlabel(
    "Time Period",
    fontsize=13,
    fontweight="bold"
)

ax.set_ylabel(
    "Month",
    fontsize=13,
    fontweight="bold"
)


# ------------------------------------------------------------
# Put LOW / MEDIUM / HIGH inside cells
# ------------------------------------------------------------

for i in range(
    len(heat_numeric.index)
):

    for j in range(
        len(heat_numeric.columns)
    ):

        value = heat_numeric.iloc[i, j]

        if not np.isnan(value):

            state_name = STATE_NAMES[
                int(value)
            ]

            ax.text(
                j,
                i,
                state_name.upper(),
                ha="center",
                va="center",
                fontsize=10,
                fontweight="bold"
            )


# ------------------------------------------------------------
# Colorbar
# ------------------------------------------------------------

cbar = fig.colorbar(
    im,
    ax=ax,
    ticks=[0, 1, 2]
)

cbar.ax.set_yticklabels(
    [
        "Low Activity",
        "Medium Activity",
        "High Activity"
    ],
    fontsize=10
)

cbar.set_label(
    "Hidden Activity State",
    fontsize=12,
    fontweight="bold"
)


# ------------------------------------------------------------
# Title
# ------------------------------------------------------------

ax.set_title(
    "HMM Hidden Activity State by Month and Time Period",
    fontsize=19,
    fontweight="bold",
    pad=18
)


# ------------------------------------------------------------
# Explanation
# ------------------------------------------------------------

fig.text(
    0.5,
    0.015,
    "The HMM assigns each month-time period observation to a hidden "
    "crime-activity state based on burglary frequency.",
    ha="center",
    fontsize=10
)


plt.tight_layout(
    rect=[0, 0.04, 1, 1]
)


plt.savefig(
    f"{OUTPUT_DIR}/03_hmm_state_heatmap.png",
    dpi=300,
    bbox_inches="tight"
)

plt.close()

print(
    "Saved: 03_hmm_state_heatmap.png"
)
# ============================================================
# 4. HMM TRANSITION MATRIX
# ============================================================

print("\n[4/5] Creating HMM transition matrix...")


transition_matrix = None


# Try common attribute names
possible_attributes = [
    "transition_matrix",
    "transmat_",
    "transition_probabilities",
    "transition_probs"
]


for attribute in possible_attributes:

    if hasattr(model, attribute):

        transition_matrix = getattr(
            model,
            attribute
        )

        break


# Try dictionary-based model
if transition_matrix is None:

    if isinstance(model, dict):

        for key in possible_attributes:

            if key in model:

                transition_matrix = model[key]

                break


if transition_matrix is not None:

    transition_matrix = np.asarray(
        transition_matrix
    )

    plt.figure(figsize=(9, 7))

    plt.imshow(
        transition_matrix,
        aspect="auto"
    )

    plt.colorbar(
        label="Transition Probability"
    )

    number_of_states = transition_matrix.shape[0]

    state_labels = [
    "Low",
    "Medium",
    "High"
]

    plt.xticks(
        range(number_of_states),
        state_labels
    )

    plt.yticks(
        range(number_of_states),
        state_labels
    )

    plt.xlabel(
    "Next Activity State",
    fontsize=12,
    fontweight="bold"
)

    plt.ylabel(
    "Current Activity State",
    fontsize=12,
    fontweight="bold"
)

    plt.title(
    "HMM Transition Probability Between Crime Activity States",
    fontsize=18,
    fontweight="bold",
    pad=15
)


    # Display probabilities
    for i in range(number_of_states):

        for j in range(number_of_states):

            value = transition_matrix[i, j]

            plt.text(
                j,
                i,
                f"{value:.2f}",
                ha="center",
                va="center",
                fontsize=12,
                fontweight="bold"
            )


    plt.tight_layout()

    plt.savefig(
        f"{OUTPUT_DIR}/04_transition_matrix.png",
        dpi=300,
        bbox_inches="tight"
    )

    plt.close()

    print(
        "Saved: 04_transition_matrix.png"
    )

else:

    print(
        "WARNING: Could not find transition matrix in model."
    )



# ============================================================
# 5. ACTIVITY STATE BY MONTH
# ============================================================

print("\n[5/5] Creating monthly state summary...")

# Use the actual columns present in the dataset
month_col = "incident_month"
state_name_col = "hidden_state"

# Count hidden states for each month
state_summary = (
    states_plot
    .groupby([month_col, state_name_col])
    .size()
    .unstack(fill_value=0)
)

# Ensure all three states appear, even if a month has zero
# observations for one of the states
state_summary = state_summary.reindex(
    columns=[0, 1, 2],
    fill_value=0
)

state_summary.columns = [
    "Low Activity",
    "Medium Activity",
    "High Activity"
]

ax = state_summary.plot(
    kind="bar",
    figsize=(12, 7),
    width=0.8
)

ax.set_title(
    "Hidden Activity States Across Months",
    fontsize=18,
    fontweight="bold"
)
ax.set_xlabel("Month", fontsize=12)
ax.set_ylabel("Number of Time Periods", fontsize=12)
ax.set_xticklabels(state_summary.index, rotation=0)
ax.grid(axis="y", linestyle="--", alpha=0.3)
ax.legend(title="Hidden State")

plt.tight_layout()
plt.savefig(
    f"{OUTPUT_DIR}/05_monthly_hidden_states.png",
    dpi=300,
    bbox_inches="tight"
)
plt.close()

print("Saved: 05_monthly_hidden_states.png")



# ============================================================
# FINAL OUTPUT
# ============================================================

print("\n" + "=" * 70)
print("HMM VISUALIZATION COMPLETE")
print("=" * 70)

print("\nGenerated files:")

for filename in os.listdir(OUTPUT_DIR):

    if filename.endswith(".png"):

        print(
            f"  ✓ {OUTPUT_DIR}/{filename}"
        )

print("\nThese visualizations are ready for your PPT/report.")