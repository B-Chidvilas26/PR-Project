import pandas as pd

print("=" * 70)
print("PREPARING DATA FOR HIDDEN MARKOV MODEL")
print("=" * 70)

# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading burglary dataset...")

df = pd.read_csv(
    "burglary_bn_dataset.csv"
)

print("Rows:", len(df))

# ============================================================
# KEEP REQUIRED VARIABLES
# ============================================================

hmm_data = df[
    [
        "incident_month",
        "time_period"
    ]
].copy()

# Remove unknown time periods
hmm_data = hmm_data[
    hmm_data["time_period"] != "Unknown"
]

# ============================================================
# COUNT CRIMES BY MONTH AND TIME PERIOD
# ============================================================

print("\nAggregating burglary incidents...")

monthly_counts = (
    hmm_data
    .groupby(
        ["incident_month", "time_period"]
    )
    .size()
    .reset_index(
        name="crime_count"
    )
)

# ============================================================
# DISPLAY RESULTS
# ============================================================

print("\n" + "=" * 70)
print("MONTHLY CRIME COUNTS")
print("=" * 70)

print(
    monthly_counts.to_string(
        index=False
    )
)

# ============================================================
# SAVE
# ============================================================

monthly_counts.to_csv(
    "burglary_hmm_dataset.csv",
    index=False
)

print("\nDataset saved as:")
print("burglary_hmm_dataset.csv")

print("\nDONE")