import pandas as pd

from pgmpy.models import DiscreteBayesianNetwork
from pgmpy.estimators import MaximumLikelihoodEstimator

print("=" * 70)
print("BURGLARY BAYESIAN NETWORK")
print("=" * 70)

# ---------------------------------------------------------
# 1. LOAD DATA
# ---------------------------------------------------------

print("\nLoading dataset...")

df = pd.read_csv(
    "burglary_bn_dataset.csv",
    low_memory=False
)

print("Rows:", len(df))


# ---------------------------------------------------------
# 2. SELECT BN VARIABLES
# ---------------------------------------------------------

columns = [
    "incident_month",
    "day_type",
    "time_period",

    "location",
    "entry_method",
    "attempt_completed",
    "cleared_except_id",

    "victim_type",
    "victim_age_group",
    "victim_sex",
    "victim_ethnicity",
    "resident_status",

    "offender_age_group",
    "offender_sex",
    "offender_ethnicity",

    "relationship",

    "property_loss",
    "property_stolen",
    "property_recovered",

    "num_premises_entered"
]

data = df[columns].copy()


# ---------------------------------------------------------
# 3. CONVERT VARIABLES TO CATEGORICAL
# ---------------------------------------------------------

print("\nPreparing categorical variables...")

for column in data.columns:
    data[column] = data[column].fillna("Unknown")
    data[column] = data[column].astype(str)


# ---------------------------------------------------------
# 4. CREATE BN STRUCTURE
# ---------------------------------------------------------

print("\nCreating Bayesian Network...")

edges = [

    # Time
    ("incident_month", "day_type"),
    ("day_type", "time_period"),

    # Incident
    ("time_period", "location"),
    ("location", "entry_method"),
    ("entry_method", "attempt_completed"),
    ("attempt_completed", "cleared_except_id"),
    ("attempt_completed", "num_premises_entered"),

    # Victim
    ("location", "victim_type"),
    ("victim_type", "victim_age_group"),
    ("victim_age_group", "victim_sex"),
    ("victim_age_group", "victim_ethnicity"),
    ("victim_age_group", "resident_status"),

    # Relationship / offender
    ("victim_type", "relationship"),
    ("relationship", "offender_age_group"),
    ("relationship", "offender_sex"),
    ("relationship", "offender_ethnicity"),

    # Property
    ("location", "property_loss"),
    ("property_loss", "property_stolen"),
    ("property_loss", "property_recovered")
]


model = DiscreteBayesianNetwork(edges)

print("Number of nodes:", len(model.nodes()))
print("Number of edges:", len(model.edges()))

print("\nNodes:")
for node in model.nodes():
    print(" -", node)

print("\nEdges:")
for edge in model.edges():
    print(" -", edge)


# ---------------------------------------------------------
# 5. CHECK MODEL
# ---------------------------------------------------------

print("\nChecking network structure...")

import networkx as nx

if nx.is_directed_acyclic_graph(model):
    print("DAG check: PASSED")
else:
    print("DAG check: FAILED")
    exit()


# ---------------------------------------------------------
# 6. LEARN CPDs
# ---------------------------------------------------------

print("\nLearning probability distributions...")

model.fit(data)

print("CPDs learned successfully.")


# ---------------------------------------------------------
# 7. MODEL CHECK
# ---------------------------------------------------------

print("\nChecking learned model...")

if model.check_model():
    print("Model check: PASSED")
else:
    print("Model check: FAILED")


# ---------------------------------------------------------
# 8. SHOW CPDs
# ---------------------------------------------------------

print("\n" + "=" * 70)
print("LEARNED CONDITIONAL PROBABILITY DISTRIBUTIONS")
print("=" * 70)

for cpd in model.get_cpds():

    print("\n" + "-" * 70)
    print(cpd)


print("\n" + "=" * 70)
print("BAYESIAN NETWORK TRAINING COMPLETE")
print("=" * 70)

import pickle

# Save trained Bayesian Network
with open("burglary_bn_model.pkl", "wb") as f:
    pickle.dump(model, f)

print("\nModel saved as: burglary_bn_model.pkl")