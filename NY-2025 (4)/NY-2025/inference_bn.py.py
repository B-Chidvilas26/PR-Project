import pickle
from pgmpy.inference import VariableElimination

print("=" * 70)
print("BURGLARY BAYESIAN NETWORK - INFERENCE")
print("=" * 70)

# ------------------------------------------------------------
# LOAD TRAINED MODEL
# ------------------------------------------------------------

print("\nLoading trained Bayesian Network...")

with open("burglary_bn_model.pkl", "rb") as f:
    model = pickle.load(f)

print("Model loaded successfully.")

# ------------------------------------------------------------
# CHECK MODEL
# ------------------------------------------------------------

print("\nNumber of nodes:", len(model.nodes()))
print("Number of edges:", len(model.edges()))

# ------------------------------------------------------------
# CREATE INFERENCE ENGINE
# ------------------------------------------------------------

print("\nCreating inference engine...")

inference = VariableElimination(model)

print("Inference engine ready.")

# ------------------------------------------------------------
# QUERY 1
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("QUERY 1: PROBABILITY OF ATTEMPTED / COMPLETED BURGLARY")
print("=" * 70)

result = inference.query(
    variables=["attempt_completed"],
    show_progress=False
)

print(result)

# ------------------------------------------------------------
# QUERY 2
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("QUERY 2: PROBABILITY OF ENTRY METHOD")
print("=" * 70)

result = inference.query(
    variables=["entry_method"],
    show_progress=False
)

print(result)

# ------------------------------------------------------------
# QUERY 3
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("QUERY 3: PROBABILITY OF TIME PERIOD")
print("=" * 70)

result = inference.query(
    variables=["time_period"],
    show_progress=False
)

print(result)

# ------------------------------------------------------------
# QUERY 4
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("QUERY 4: PROBABILITY OF VICTIM SEX")
print("=" * 70)

result = inference.query(
    variables=["victim_sex"],
    show_progress=False
)

print(result)

# ------------------------------------------------------------
# QUERY 5 - CONDITIONAL PROBABILITY
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("QUERY 5: ENTRY METHOD GIVEN LOCATION")
print("=" * 70)

result = inference.query(
    variables=["entry_method"],
    evidence={"location": "24"},
    show_progress=False
)

print(result)

# ------------------------------------------------------------
# QUERY 6 - CONDITIONAL PROBABILITY
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("QUERY 6: ATTEMPT/COMPLETION GIVEN ENTRY METHOD")
print("=" * 70)

result = inference.query(
    variables=["attempt_completed"],
    evidence={"entry_method": "F"},
    show_progress=False
)

print(result)

# ------------------------------------------------------------
# QUERY 7 - CONDITIONAL PROBABILITY
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("QUERY 7: PROPERTY STOLEN GIVEN PROPERTY LOSS")
print("=" * 70)

result = inference.query(
    variables=["property_stolen"],
    evidence={"property_loss": "7"},
    show_progress=False
)

print(result)

# ------------------------------------------------------------
# FINISHED
# ------------------------------------------------------------

print("\n" + "=" * 70)
print("BAYESIAN INFERENCE COMPLETE")
print("=" * 70)