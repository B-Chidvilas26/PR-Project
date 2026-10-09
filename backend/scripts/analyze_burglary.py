import pandas as pd

print("Loading data...")

offense = pd.read_csv(
    "NIBRS_OFFENSE.csv",
    low_memory=False
)

incident = pd.read_csv(
    "NIBRS_incident.csv",
    low_memory=False
)

victim = pd.read_csv(
    "NIBRS_VICTIM.csv",
    low_memory=False
)

offender = pd.read_csv(
    "NIBRS_OFFENDER.csv",
    low_memory=False
)

weapon = pd.read_csv(
    "NIBRS_WEAPON.csv",
    low_memory=False
)

property_df = pd.read_csv(
    "NIBRS_PROPERTY.csv",
    low_memory=False
)

criminal_act = pd.read_csv(
    "NIBRS_CRIMINAL_ACT.csv",
    low_memory=False
)

victim_offender = pd.read_csv(
    "NIBRS_VICTIM_OFFENDER_REL.csv",
    low_memory=False
)

print("\n" + "=" * 60)
print("TOTAL DATA")
print("=" * 60)

print("Total offenses:", len(offense))
print("Total incidents:", incident["incident_id"].nunique())
print("Total victims:", len(victim))
print("Total offenders:", len(offender))
print("Total weapons:", len(weapon))
print("Total property records:", len(property_df))


# ---------------------------------------------------------
# BURGLARY
# ---------------------------------------------------------

burglary = offense[
    offense["offense_code"].astype(str) == "220"
].copy()

print("\n" + "=" * 60)
print("BURGLARY DATA")
print("=" * 60)

print("Burglary offense records:", len(burglary))
print(
    "Unique burglary incidents:",
    burglary["incident_id"].nunique()
)


# ---------------------------------------------------------
# BURGLARY + INCIDENT
# ---------------------------------------------------------

burglary_incidents = burglary.merge(
    incident,
    on=["data_year", "incident_id"],
    how="left"
)

print("\n" + "=" * 60)
print("BURGLARY INCIDENT INFORMATION")
print("=" * 60)

print(
    "Burglary incidents with incident hour:",
    burglary_incidents["incident_hour"].notna().sum()
)

print(
    "Burglary incidents with incident date:",
    burglary_incidents["incident_date"].notna().sum()
)

print("\nIncident hour distribution:")
print(
    burglary_incidents["incident_hour"]
    .value_counts(dropna=False)
    .sort_index()
    .head(30)
)


# ---------------------------------------------------------
# ATTEMPT / COMPLETION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("ATTEMPT / COMPLETION")
print("=" * 60)

print(
    burglary["attempt_complete_flag"]
    .value_counts(dropna=False)
)


# ---------------------------------------------------------
# LOCATION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("LOCATION")
print("=" * 60)

print(
    "Known location:",
    burglary["location_id"].notna().sum()
)

print(
    "Missing location:",
    burglary["location_id"].isna().sum()
)


# ---------------------------------------------------------
# METHOD OF ENTRY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("METHOD OF ENTRY")
print("=" * 60)

print(
    "Known method of entry:",
    burglary["method_entry_code"].notna().sum()
)

print(
    "Missing method of entry:",
    burglary["method_entry_code"].isna().sum()
)

print("\nMethod of entry distribution:")
print(
    burglary["method_entry_code"]
    .value_counts(dropna=False)
    .head(20)
)


# ---------------------------------------------------------
# PREMISES ENTERED
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("PREMISES ENTERED")
print("=" * 60)

print(
    burglary["num_premises_entered"]
    .describe()
)


# ---------------------------------------------------------
# WEAPONS
# ---------------------------------------------------------

burglary_weapon = weapon[
    weapon["offense_id"].isin(
        burglary["offense_id"]
    )
]

print("\n" + "=" * 60)
print("WEAPONS")
print("=" * 60)

print(
    "Burglary offenses with weapon records:",
    burglary_weapon["offense_id"].nunique()
)


# ---------------------------------------------------------
# VICTIMS
# ---------------------------------------------------------

burglary_victim_offense = pd.read_csv(
    "NIBRS_VICTIM_OFFENSE.csv",
    low_memory=False
)

burglary_victims = victim[
    victim["incident_id"].isin(
        burglary["incident_id"]
    )
]

print("\n" + "=" * 60)
print("VICTIMS")
print("=" * 60)

print(
    "Burglary victim records:",
    len(burglary_victims)
)

print(
    "Unique burglary incidents with victims:",
    burglary_victims["incident_id"].nunique()
)


# ---------------------------------------------------------
# OFFENDERS
# ---------------------------------------------------------

burglary_offenders = offender[
    offender["incident_id"].isin(
        burglary["incident_id"]
    )
]

print("\n" + "=" * 60)
print("OFFENDERS")
print("=" * 60)

print(
    "Burglary offender records:",
    len(burglary_offenders)
)

print(
    "Unique burglary incidents with offenders:",
    burglary_offenders["incident_id"].nunique()
)


# ---------------------------------------------------------
# PROPERTY
# ---------------------------------------------------------

burglary_property = property_df[
    property_df["incident_id"].isin(
        burglary["incident_id"]
    )
]

print("\n" + "=" * 60)
print("PROPERTY")
print("=" * 60)

print(
    "Burglary property records:",
    len(burglary_property)
)

print(
    "Unique burglary incidents with property:",
    burglary_property["incident_id"].nunique()
)


# ---------------------------------------------------------
# CRIMINAL ACTIVITY
# ---------------------------------------------------------

burglary_criminal_act = criminal_act[
    criminal_act["offense_id"].isin(
        burglary["offense_id"]
    )
]

print("\n" + "=" * 60)
print("CRIMINAL ACTIVITY")
print("=" * 60)

print(
    "Burglary offenses with criminal activity:",
    burglary_criminal_act["offense_id"].nunique()
)


# ---------------------------------------------------------
# FINAL SUMMARY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)

print("Burglary incidents:", burglary["incident_id"].nunique())
print("Known time:", burglary_incidents["incident_hour"].notna().sum())
print("Known location:", burglary["location_id"].notna().sum())
print("Known entry method:", burglary["method_entry_code"].notna().sum())
print("Weapon records:", burglary_weapon["offense_id"].nunique())
print("Victim incidents:", burglary_victims["incident_id"].nunique())
print("Offender incidents:", burglary_offenders["incident_id"].nunique())
print("Property incidents:", burglary_property["incident_id"].nunique())
print("Criminal activity incidents:", burglary_criminal_act["offense_id"].nunique())

print("\nDONE")