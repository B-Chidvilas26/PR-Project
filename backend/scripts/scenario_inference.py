import pickle
from pgmpy.inference import VariableElimination

print("=" * 70)
print("BURGLARY BAYESIAN NETWORK - SCENARIO INFERENCE")
print("=" * 70)

# Load trained model
with open("burglary_bn_model.pkl", "rb") as f:
    model = pickle.load(f)

inference = VariableElimination(model)

print("\nModel loaded successfully.")

# ============================================================
# SCENARIO 1
# ============================================================

print("\n" + "=" * 70)
print("SCENARIO 1")
print("Given: Night + Forced Entry")
print("Question: Was the burglary attempted or completed?")
print("=" * 70)

result = inference.query(
    variables=["attempt_completed"],
    evidence={
        "time_period": "Night",
        "entry_method": "F"
    },
    show_progress=False
)

print(result)

# ============================================================
# SCENARIO 2
# ============================================================

print("\n" + "=" * 70)
print("SCENARIO 2")
print("Given: Afternoon + Non-Forced Entry")
print("Question: Was the burglary attempted or completed?")
print("=" * 70)

result = inference.query(
    variables=["attempt_completed"],
    evidence={
        "time_period": "Afternoon",
        "entry_method": "N"
    },
    show_progress=False
)

print(result)

# ============================================================
# SCENARIO 3
# ============================================================

print("\n" + "=" * 70)
print("SCENARIO 3")
print("Given: Forced Entry + Completed Burglary")
print("Question: What type of property loss is expected?")
print("=" * 70)

result = inference.query(
    variables=["property_loss"],
    evidence={
        "entry_method": "F",
        "attempt_completed": "C"
    },
    show_progress=False
)

print(result)

# ============================================================
# SCENARIO 4
# ============================================================

print("\n" + "=" * 70)
print("SCENARIO 4")
print("Given: Night + Forced Entry")
print("Question: What victim age group is more probable?")
print("=" * 70)

result = inference.query(
    variables=["victim_age_group"],
    evidence={
        "time_period": "Night",
        "entry_method": "F"
    },
    show_progress=False
)

print(result)

# ============================================================
# SCENARIO 5
# ============================================================

print("\n" + "=" * 70)
print("SCENARIO 5")
print("Given: Completed Burglary + Forced Entry")
print("Question: What offender characteristics are probable?")
print("=" * 70)

result = inference.query(
    variables=[
        "offender_age_group",
        "offender_sex"
    ],
    evidence={
        "attempt_completed": "C",
        "entry_method": "F"
    },
    show_progress=False
)

print(result)

print("\n" + "=" * 70)
print("SCENARIO INFERENCE COMPLETE")
print("=" * 70)