import pandas as pd
import numpy as np

print("=" * 70)
print("PREPARING BURGLARY DATASET FOR BAYESIAN NETWORK")
print("=" * 70)

# ---------------------------------------------------------
# 1. LOAD DATA
# ---------------------------------------------------------

print("\nLoading files...")

offense = pd.read_csv("NIBRS_OFFENSE.csv", low_memory=False)
incident = pd.read_csv("NIBRS_incident.csv", low_memory=False)
victim = pd.read_csv("NIBRS_VICTIM.csv", low_memory=False)
offender = pd.read_csv("NIBRS_OFFENDER.csv", low_memory=False)
relationship = pd.read_csv(
    "NIBRS_VICTIM_OFFENDER_REL.csv",
    low_memory=False
)
property_df = pd.read_csv(
    "NIBRS_PROPERTY.csv",
    low_memory=False
)

print("Files loaded.")


# ---------------------------------------------------------
# 2. SELECT BURGLARY OFFENSES
# ---------------------------------------------------------

print("\nFiltering burglary incidents...")

burglary = offense[
    offense["offense_code"].astype(str) == "220"
].copy()

burglary_ids = burglary["incident_id"].unique()

print("Burglary incidents:", len(burglary_ids))


# ---------------------------------------------------------
# 3. INCIDENT INFORMATION
# ---------------------------------------------------------

print("\nProcessing incident information...")

b_incident = incident[
    incident["incident_id"].isin(burglary_ids)
].copy()

incident_data = b_incident[
    [
        "incident_id",
        "incident_date",
        "incident_hour",
        "cleared_except_id",
        "incident_status"
    ]
].copy()


# ---------------------------------------------------------
# 4. OFFENSE INFORMATION
# ---------------------------------------------------------

print("Processing offense information...")

offense_data = burglary[
    [
        "incident_id",
        "location_id",
        "attempt_complete_flag",
        "num_premises_entered",
        "method_entry_code"
    ]
].copy()

# Make sure there is only ONE row per incident
offense_data = offense_data.drop_duplicates(
    subset=["incident_id"]
)


# ---------------------------------------------------------
# 5. VICTIM INFORMATION
# ---------------------------------------------------------

print("Processing victim information...")

b_victim = victim[
    victim["incident_id"].isin(burglary_ids)
].copy()

# Select one representative victim per incident.
# We use the first victim record for the initial BN dataset.

victim_data = b_victim[
    [
        "incident_id",
        "victim_type_id",
        "age_num",
        "sex_code",
        "ethnicity_id",
        "resident_status_code"
    ]
].copy()

victim_data = victim_data.drop_duplicates(
    subset=["incident_id"]
)


# ---------------------------------------------------------
# 6. OFFENDER INFORMATION
# ---------------------------------------------------------

print("Processing offender information...")

b_offender = offender[
    offender["incident_id"].isin(burglary_ids)
].copy()

offender_data = b_offender[
    [
        "incident_id",
        "age_num",
        "sex_code",
        "ethnicity_id"
    ]
].copy()

offender_data = offender_data.drop_duplicates(
    subset=["incident_id"]
)

# Rename offender columns
offender_data = offender_data.rename(
    columns={
        "age_num": "offender_age",
        "sex_code": "offender_sex",
        "ethnicity_id": "offender_ethnicity"
    }
)


# ---------------------------------------------------------
# 7. VICTIM-OFFENDER RELATIONSHIP
# ---------------------------------------------------------

print("Processing relationships...")

b_rel = relationship[
    relationship["victim_id"].isin(
        set(b_victim["victim_id"])
    )
].copy()

# Connect relationship → victim → incident

b_rel = b_rel.merge(
    b_victim[
        ["victim_id", "incident_id"]
    ],
    on="victim_id",
    how="left"
)

relationship_data = b_rel[
    [
        "incident_id",
        "relationship_id"
    ]
].copy()

relationship_data = relationship_data.drop_duplicates(
    subset=["incident_id"]
)


# ---------------------------------------------------------
# 8. PROPERTY INFORMATION
# ---------------------------------------------------------

print("Processing property information...")

b_property = property_df[
    property_df["incident_id"].isin(burglary_ids)
].copy()

property_data = b_property[
    [
        "incident_id",
        "prop_loss_id",
        "stolen_count",
        "recovered_count"
    ]
].copy()

property_data = property_data.drop_duplicates(
    subset=["incident_id"]
)


# ---------------------------------------------------------
# 9. MERGE EVERYTHING
# ---------------------------------------------------------

print("\nMerging datasets...")

df = incident_data.merge(
    offense_data,
    on="incident_id",
    how="left"
)

df = df.merge(
    victim_data,
    on="incident_id",
    how="left"
)

df = df.merge(
    offender_data,
    on="incident_id",
    how="left"
)

df = df.merge(
    relationship_data,
    on="incident_id",
    how="left"
)

df = df.merge(
    property_data,
    on="incident_id",
    how="left"
)


# ---------------------------------------------------------
# 10. CREATE TIME VARIABLES
# ---------------------------------------------------------

print("Creating time variables...")

df["incident_date"] = pd.to_datetime(
    df["incident_date"],
    errors="coerce"
)

df["incident_month"] = df["incident_date"].dt.month

df["day_of_week"] = df["incident_date"].dt.day_name()

df["day_type"] = np.where(
    df["incident_date"].dt.dayofweek >= 5,
    "Weekend",
    "Weekday"
)


def get_time_period(hour):

    if pd.isna(hour):
        return "Unknown"

    hour = int(hour)

    if 0 <= hour < 6:
        return "Night"

    elif 6 <= hour < 12:
        return "Morning"

    elif 12 <= hour < 18:
        return "Afternoon"

    else:
        return "Evening"


df["time_period"] = df["incident_hour"].apply(
    get_time_period
)


# ---------------------------------------------------------
# 11. CREATE AGE GROUPS
# ---------------------------------------------------------

def victim_age_group(age):

    if pd.isna(age) or str(age) in ["NS", "nan"]:
        return "Unknown"

    try:
        age = int(age)

        if age < 18:
            return "Minor"

        elif age < 30:
            return "Young_Adult"

        elif age < 50:
            return "Adult"

        elif age < 65:
            return "Middle_Aged"

        else:
            return "Senior"

    except:
        return "Unknown"


def offender_age_group(age):

    if pd.isna(age) or str(age) in ["NS", "00", "nan"]:
        return "Unknown"

    try:
        age = int(age)

        if age < 18:
            return "Minor"

        elif age < 30:
            return "Young_Adult"

        elif age < 50:
            return "Adult"

        elif age < 65:
            return "Middle_Aged"

        else:
            return "Senior"

    except:
        return "Unknown"


df["victim_age_group"] = df["age_num"].apply(
    victim_age_group
)

df["offender_age_group"] = df["offender_age"].apply(
    offender_age_group
)


# ---------------------------------------------------------
# 12. CREATE PROPERTY VARIABLES
# ---------------------------------------------------------

df["property_stolen"] = np.where(
    df["stolen_count"].notna(),
    "Yes",
    "Unknown"
)

df["property_recovered"] = np.where(
    df["recovered_count"].notna(),
    "Yes",
    "Unknown"
)


# ---------------------------------------------------------
# 13. CLEAN UNKNOWN VALUES
# ---------------------------------------------------------

df["victim_sex"] = df["sex_code"].fillna("Unknown")

df["offender_sex"] = df["offender_sex"].fillna("Unknown")

df["victim_ethnicity"] = df["ethnicity_id"].fillna("Unknown")

df["offender_ethnicity"] = df[
    "offender_ethnicity"
].fillna("Unknown")

df["resident_status"] = df[
    "resident_status_code"
].fillna("Unknown")

df["relationship"] = df[
    "relationship_id"
].fillna("Unknown")

df["location"] = df[
    "location_id"
].fillna("Unknown")

df["entry_method"] = df[
    "method_entry_code"
].fillna("Unknown")

df["attempt_completed"] = df[
    "attempt_complete_flag"
].fillna("Unknown")

df["victim_type"] = df[
    "victim_type_id"
].fillna("Unknown")

df["property_loss"] = df[
    "prop_loss_id"
].fillna("Unknown")


# ---------------------------------------------------------
# 14. SELECT FINAL BN VARIABLES
# ---------------------------------------------------------

bn_columns = [
    "incident_id",

    # Time
    "incident_hour",
    "incident_month",
    "day_of_week",
    "day_type",
    "time_period",

    # Incident
    "location",
    "entry_method",
    "attempt_completed",
    "num_premises_entered",
    "cleared_except_id",

    # Victim
    "victim_type",
    "victim_age_group",
    "victim_sex",
    "victim_ethnicity",
    "resident_status",

    # Offender
    "offender_age_group",
    "offender_sex",
    "offender_ethnicity",

    # Relationship
    "relationship",

    # Property
    "property_loss",
    "property_stolen",
    "property_recovered"
]

bn_df = df[bn_columns].copy()


# ---------------------------------------------------------
# 15. SAVE DATASET
# ---------------------------------------------------------

output_file = "burglary_bn_dataset.csv"

bn_df.to_csv(
    output_file,
    index=False
)


# ---------------------------------------------------------
# 16. FINAL SUMMARY
# ---------------------------------------------------------

print("\n" + "=" * 70)
print("FINAL BN DATASET")
print("=" * 70)

print("Rows:", len(bn_df))
print("Columns:", len(bn_df.columns))

print("\nColumns:")
for i, column in enumerate(bn_df.columns, 1):
    print(f"{i:2}. {column}")

print("\nMissing values:")
print(
    bn_df.isna().sum()
)

print("\nDataset saved as:")
print(output_file)

print("\nFirst 5 rows:")
print(
    bn_df.head().to_string(index=False)
)

print("\nDONE!")