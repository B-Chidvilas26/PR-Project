from pathlib import Path

# Root workspace directory
WORKSPACE_DIR = Path(__file__).resolve().parent.parent.parent

# Original source-of-truth directory from NY-2025.zip (kept untouched)
SOURCE_DATA_DIR = WORKSPACE_DIR / "NY-2025 (4)" / "NY-2025"

# Pre-trained model files
BN_MODEL_PATH = SOURCE_DATA_DIR / "burglary_bn_model.pkl"
HMM_MODEL_PATH = SOURCE_DATA_DIR / "burglary_hmm_model.pkl"

# Datasets and state tables
BN_DATASET_PATH = SOURCE_DATA_DIR / "burglary_bn_dataset.csv"
HMM_DATASET_PATH = SOURCE_DATA_DIR / "burglary_hmm_dataset.csv"
HMM_STATES_PATH = SOURCE_DATA_DIR / "burglary_hmm_states.csv"

# Lookup CSVs
LOOKUP_LOCATION_PATH = SOURCE_DATA_DIR / "NIBRS_LOCATION_TYPE.csv"
LOOKUP_VICTIM_TYPE_PATH = SOURCE_DATA_DIR / "NIBRS_VICTIM_TYPE.csv"
LOOKUP_RELATIONSHIP_PATH = SOURCE_DATA_DIR / "NIBRS_RELATIONSHIP.csv"
LOOKUP_PROP_LOSS_PATH = SOURCE_DATA_DIR / "NIBRS_PROP_LOSS_TYPE.csv"
LOOKUP_ETHNICITY_PATH = SOURCE_DATA_DIR / "NIBRS_ETHNICITY.csv"
LOOKUP_CLEARED_EXCEPT_PATH = SOURCE_DATA_DIR / "NIBRS_CLEARED_EXCEPT.csv"

# Backend storage paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BACKEND_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = STORAGE_DIR / "cases.sqlite3"
UPLOADS_DIR = STORAGE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
