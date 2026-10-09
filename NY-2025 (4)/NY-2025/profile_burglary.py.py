import pandas as pd

print("Loading burglary-related data...")

offense = pd.read_csv("NIBRS_OFFENSE.csv", low_memory=False)
incident = pd.read_csv("NIBRS_incident.csv", low_memory=False)
victim = pd.read_csv("NIBRS_VICTIM.csv", low_memory=False)
offender = pd.read_csv("NIBRS_OFFENDER.csv", low_memory=False)
relationship = pd.read_csv("NIBRS_VICTIM_OFFENDER_REL.csv", low_memory=False)
property_df = pd.read_csv("NIBRS_PROPERTY.csv", low_memory=False)
location = pd.read_csv("NIBRS_LOCATION_TYPE.csv", low_memory=False)
victim_type = pd.read_csv("NIBRS_VICTIM_TYPE.csv", low_memory=False)
rel_type = pd.read_csv("NIBRS_RELATIONSHIP.csv", low_memory=False)
prop_loss = pd.read_csv("NIBRS_PROP_LOSS_TYPE.csv", low_memory=False)
offense_type = pd.read_csv("NIBRS_OFFENSE_TYPE.csv", low_memory=False)

# Burglary
burglary = offense[
    offense["offense_code"].astype(str) == "220"
].copy()

incident_ids = set(burglary["incident_id"])

# Filter
b_incident = incident[
    incident["incident_id"].isin(incident_ids)
].copy()

b_victim = victim[
    victim["incident_id"].isin(incident_ids)
].copy()

b_offender = offender[
    offender["incident_id"].isin(incident_ids)
].copy()

print("\n" + "="*70)
print("BURGLARY DATASET")
print("="*70)

print("Incidents:", len(incident_ids))


def show(title, series, n=20):
    print("\n" + "-"*60)
    print(title)
    print("-"*60)
    print("Unique:", series.nunique(dropna=True))
    print("Missing:", series.isna().sum())
    print(series.value_counts(dropna=False).head(n))


# Incident
show("Incident Hour", b_incident["incident_hour"])
show("Cleared Except", b_incident["cleared_except_id"])
show("Incident Status", b_incident["incident_status"])

# Offense
show("Location ID", burglary["location_id"])
show("Attempt / Complete", burglary["attempt_complete_flag"])
show("Method Entry", burglary["method_entry_code"])

# Victim
show("Victim Type", b_victim["victim_type_id"])
show("Victim Age", b_victim["age_num"])
show("Victim Sex", b_victim["sex_code"])
show("Victim Race", b_victim["race_id"])
show("Victim Ethnicity", b_victim["ethnicity_id"])
show("Victim Resident Status", b_victim["resident_status_code"])

# Offender
show("Offender Age", b_offender["age_num"])
show("Offender Sex", b_offender["sex_code"])
show("Offender Race", b_offender["race_id"])
show("Offender Ethnicity", b_offender["ethnicity_id"])

# Relationships
b_rel = relationship[
    relationship["victim_id"].isin(
        set(b_victim["victim_id"])
    )
]

show("Relationship ID", b_rel["relationship_id"])

# Property
b_prop = property_df[
    property_df["incident_id"].isin(incident_ids)
]

show("Property Loss Type", b_prop["prop_loss_id"])
show("Stolen Count", b_prop["stolen_count"])
show("Recovered Count", b_prop["recovered_count"])


print("\n" + "="*70)
print("LOOKUP TABLES")
print("="*70)

print("\nLOCATION TYPES:")
print(location.to_string(index=False))

print("\nVICTIM TYPES:")
print(victim_type.to_string(index=False))

print("\nRELATIONSHIP TYPES:")
print(rel_type.to_string(index=False))

print("\nPROPERTY LOSS TYPES:")
print(prop_loss.to_string(index=False))

print("\nOFFENSE TYPE FOR BURGLARY:")
print(
    offense_type[
        offense_type["offense_code"].astype(str) == "220"
    ].to_string(index=False)
)

print("\nDONE")