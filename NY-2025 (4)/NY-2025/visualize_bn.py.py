import os
import joblib
import matplotlib.pyplot as plt
import networkx as nx
import pandas as pd

from pgmpy.inference import VariableElimination


# ============================================================
# SETTINGS
# ============================================================

OUTPUT_DIR = "visualizations"
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 70)
print("BURGLARY BAYESIAN NETWORK - FINAL VISUALIZATIONS")
print("=" * 70)


# ============================================================
# LOAD MODEL
# ============================================================

print("\nLoading trained Bayesian Network...")

model = joblib.load("burglary_bn_model.pkl")

print("Model loaded successfully.")
print(f"Nodes : {len(model.nodes())}")
print(f"Edges : {len(model.edges())}")


inference = VariableElimination(model)


# ============================================================
# 1. PROFESSIONAL BAYESIAN NETWORK DIAGRAM
# ============================================================

print("\n[1/7] Creating Bayesian Network architecture...")


# Actual nodes from your trained model
nodes = list(model.nodes())
edges = list(model.edges())


# Logical grouping of the 20 nodes
groups = {

    "TIME & CONTEXT": [
        "incident_month",
        "day_type",
        "time_period",
        "location"
    ],

    "OFFENSE": [
        "entry_method",
        "attempt_completed",
        "cleared_except_id",
        "num_premises_entered"
    ],

    "VICTIM": [
        "victim_type",
        "victim_age_group",
        "victim_sex",
        "victim_ethnicity",
        "resident_status",
        "relationship"
    ],

    "OFFENDER": [
        "offender_age_group",
        "offender_sex",
        "offender_ethnicity"
    ],

    "PROPERTY": [
        "property_loss",
        "property_stolen",
        "property_recovered"
    ]
}


# Positions manually arranged for readability
pos = {

    # TIME & CONTEXT
    "incident_month": (-6, 6),
    "day_type": (-2, 6),
    "time_period": (2, 6),
    "location": (6, 6),

    # OFFENSE
    "entry_method": (6, 3),
    "attempt_completed": (6, 0),
    "cleared_except_id": (6, -3),
    "num_premises_entered": (2, -3),

    # VICTIM
    "victim_type": (-6, 3),
    "victim_age_group": (-6, 0),
    "victim_sex": (-9, -3),
    "victim_ethnicity": (-6, -3),
    "resident_status": (-3, -3),
    "relationship": (-6, -6),

    # OFFENDER
    "offender_age_group": (-2, -6),
    "offender_sex": (1, -6),
    "offender_ethnicity": (4, -6),

    # PROPERTY
    "property_loss": (10, 3),
    "property_stolen": (10, 0),
    "property_recovered": (10, -3)
}


G = nx.DiGraph()

G.add_nodes_from(nodes)
G.add_edges_from(edges)


plt.figure(figsize=(20, 14))

# Draw edges first
nx.draw_networkx_edges(
    G,
    pos,
    edgelist=list(G.edges()),
    arrows=True,
    arrowstyle="-|>",
    arrowsize=28,
    width=2.2,
    edge_color="black",
    alpha=0.9,
    node_size=3300,
    node_shape="o",
    min_source_margin=18,
    min_target_margin=22,
    connectionstyle="arc3,rad=0.06"
)

# Draw nodes
nx.draw_networkx_nodes(
    G,
    pos,
    node_size=3300,
    node_color="white",
    edgecolors="black",
    linewidths=2.5
)

# Short readable labels
labels = {
    "incident_month": "Incident\nMonth",
    "day_type": "Day Type",
    "time_period": "Time\nPeriod",
    "location": "Location",

    "entry_method": "Entry\nMethod",
    "attempt_completed": "Attempt /\nCompleted",
    "cleared_except_id": "Clearance\nStatus",
    "num_premises_entered": "Premises\nEntered",

    "victim_type": "Victim\nType",
    "victim_age_group": "Victim Age\nGroup",
    "victim_sex": "Victim\nSex",
    "victim_ethnicity": "Victim\nEthnicity",
    "resident_status": "Resident\nStatus",
    "relationship": "Victim-Offender\nRelationship",

    "offender_age_group": "Offender Age\nGroup",
    "offender_sex": "Offender\nSex",
    "offender_ethnicity": "Offender\nEthnicity",

    "property_loss": "Property\nLoss",
    "property_stolen": "Property\nStolen",
    "property_recovered": "Property\nRecovered"
}


nx.draw_networkx_labels(
    G,
    pos,
    labels=labels,
    font_size=8,
    font_weight="bold"
)


# Group labels
group_titles = [
    ("TIME & CONTEXT", (-2, 7.4)),
    ("OFFENSE", (4.5, 4.0)),
    ("VICTIM", (-6, 4.0)),
    ("OFFENDER", (1, -4.7)),
    ("PROPERTY", (10, 4.0))
]

for title, xy in group_titles:
    plt.text(
        xy[0],
        xy[1],
        title,
        fontsize=13,
        fontweight="bold",
        ha="center"
    )


plt.text(
    0,
    -7.8,
    "Directed edges represent probabilistic dependencies between burglary-related variables",
    ha="center",
    fontsize=11
)

plt.text(
    0,
    -7.8,
    "Directed edges represent probabilistic dependencies between burglary-related variables",
    ha="center",
    fontsize=11
)

plt.axis("off")
plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/01_bayesian_network_architecture.png",
    dpi=300,
    bbox_inches="tight"
)

plt.close()

print("Saved: 01_bayesian_network_architecture.png")


# ============================================================
# HELPER FUNCTION FOR PROBABILITY CHARTS
# ============================================================

def probability_bar(
    variable,
    title,
    xlabel,
    filename,
    label_map=None,
    figsize=(9, 6)
):

    result = inference.query(
        variables=[variable],
        show_progress=False
    )

    states = result.state_names[variable]
    values = result.values

    labels = []

    for state in states:

        if label_map and str(state) in label_map:
            labels.append(label_map[str(state)])
        else:
            labels.append(str(state))

    plt.figure(figsize=figsize)

    bars = plt.bar(
        labels,
        values,
        edgecolor="black",
        linewidth=1.2
    )

    plt.title(
        title,
        fontsize=17,
        fontweight="bold",
        pad=15
    )

    plt.xlabel(
        xlabel,
        fontsize=12
    )

    plt.ylabel(
        "Probability",
        fontsize=12
    )

    plt.ylim(
        0,
        max(values) * 1.25
    )

    plt.grid(
        axis="y",
        linestyle="--",
        alpha=0.3
    )

    for bar, value in zip(bars, values):

        plt.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(values) * 0.025,
            f"{value:.2%}",
            ha="center",
            fontsize=11,
            fontweight="bold"
        )

    plt.tight_layout()

    plt.savefig(
        f"{OUTPUT_DIR}/{filename}",
        dpi=300,
        bbox_inches="tight"
    )

    plt.close()

    print(f"Saved: {filename}")


# ============================================================
# 2. ATTEMPTED VS COMPLETED
# ============================================================

print("\n[2/7] Creating burglary completion chart...")

probability_bar(
    variable="attempt_completed",
    title="Probability of Attempted vs Completed Burglary",
    xlabel="Burglary Status",
    filename="02_attempted_vs_completed.png",
    label_map={
        "A": "Attempted",
        "C": "Completed"
    }
)


# ============================================================
# 3. ENTRY METHOD
# ============================================================

print("\n[3/7] Creating entry-method chart...")

probability_bar(
    variable="entry_method",
    title="Probability of Burglary Entry Method",
    xlabel="Entry Method",
    filename="03_entry_method.png",
    label_map={
        "F": "Forced",
        "N": "Non-Forced"
    }
)


# ============================================================
# 4. TIME PERIOD
# ============================================================

print("\n[4/7] Creating time-period chart...")

probability_bar(
    variable="time_period",
    title="Probability of Burglary by Time Period",
    xlabel="Time Period",
    filename="04_time_period.png"
)


# ============================================================
# 5. VICTIM SEX
# ============================================================

print("\n[5/7] Creating victim-sex chart...")

probability_bar(
    variable="victim_sex",
    title="Probability Distribution of Victim Sex",
    xlabel="Victim Sex Category",
    filename="05_victim_sex.png",
    label_map={
        "F": "Female",
        "M": "Male",
        "U": "Unknown",
        "X": "Not Specified"
    }
)


# ============================================================
# 6. PROPERTY LOSS
# ============================================================

print("\n[6/7] Creating property-loss chart...")

probability_bar(
    variable="property_loss",
    title="Probability Distribution of Property Loss",
    xlabel="Property Loss Category",
    filename="06_property_loss.png"
)


# ============================================================
# 7. SCENARIO INFERENCE
# ============================================================

print("\n[7/7] Creating scenario inference chart...")


scenario = inference.query(
    variables=["attempt_completed"],
    evidence={
        "time_period": "Night",
        "entry_method": "F"
    },
    show_progress=False
)

states = scenario.state_names["attempt_completed"]
values = scenario.values

scenario_labels = [
    "Attempted" if str(s) == "A" else "Completed"
    for s in states
]


plt.figure(figsize=(9, 6))

bars = plt.bar(
    scenario_labels,
    values,
    edgecolor="black",
    linewidth=1.2
)

plt.title(
    "Scenario: Night + Forced Entry",
    fontsize=18,
    fontweight="bold",
    pad=15
)

plt.suptitle(
    "Probability of Attempted vs Completed Burglary",
    fontsize=12,
    y=0.92
)

plt.ylabel(
    "Probability",
    fontsize=12
)

plt.ylim(
    0,
    1.05
)

plt.grid(
    axis="y",
    linestyle="--",
    alpha=0.3
)

for bar, value in zip(bars, values):

    plt.text(
        bar.get_x() + bar.get_width() / 2,
        value + 0.02,
        f"{value:.2%}",
        ha="center",
        fontsize=12,
        fontweight="bold"
    )

plt.tight_layout()

plt.savefig(
    f"{OUTPUT_DIR}/07_night_forced_scenario.png",
    dpi=300,
    bbox_inches="tight"
)

plt.close()

print("Saved: 07_night_forced_scenario.png")


# ============================================================
# FINAL
# ============================================================

print("\n" + "=" * 70)
print("FINAL BN VISUALIZATIONS COMPLETE")
print("=" * 70)

print("\nFiles created:")

files = [
    "01_bayesian_network_architecture.png",
    "02_attempted_vs_completed.png",
    "03_entry_method.png",
    "04_time_period.png",
    "05_victim_sex.png",
    "06_property_loss.png",
    "07_night_forced_scenario.png"
]

for file in files:
    print(f"  ✓ visualizations/{file}")

print("\nThese are ready for your PPT/report.")