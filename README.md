# Probabilistic Crime Scene Reconstruction

Interactive full-stack forensic workbench for **Bayesian Network (20 nodes, 19 directed edges)** and **Hidden Markov Model (3 latent regional activity states)** crime scene reconstruction, built directly on the pre-trained models and NIBRS lookup tables from `NY-2025.zip`.

> **Evidentiary Notice:** Model estimates are based on historical NIBRS burglary data and are not proof. The Hidden Markov Model describes regional activity levels by month and 6-hour time period, not minute-level or suspect-level behaviour.

---

## Folder Structure

```text
CrimeSceneReconstruction_New/
├── NY-2025 (4)/NY-2025/          # Untouched original zip contents (models, CSVs, *.py.py scripts)
├── backend/                      # Python FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py             # Paths to NY-2025 models, lookup CSVs, SQLite & uploads
│   │   ├── lookups.py            # NIBRS lookup resolvers, node/edge plain-English descriptions
│   │   ├── time_utils.py         # Date/time precision & 6-hour period mapping rules
│   │   ├── bn_engine.py          # pgmpy VariableElimination, Gibbs sampler, sensitivity & CPDs
│   │   ├── hmm_engine.py         # HMM state grid, transition matrix & cell estimator
│   │   ├── database.py           # SQLite persistence, conflict detection & 3 demo cases
│   │   ├── schemas.py            # Pydantic request schemas
│   │   └── main.py               # FastAPI endpoints & friendly 422 error handler
│   ├── scripts/                  # Clean-named (*.py) copies of original *.py.py scripts
│   ├── tests/
│   │   └── test_api.py           # Pytest suite (8 comprehensive tests)
│   └── requirements.txt          # Python dependencies (pgmpy==1.1.2, FastAPI, uvicorn, etc.)
├── frontend/                     # React + TypeScript + Vite + React Flow + Tailwind + Recharts
│   ├── src/
│   │   ├── components/
│   │   │   ├── BNCustomNode.tsx
│   │   │   ├── GraphWorkspace.tsx
│   │   │   ├── ScenarioComparisonView.tsx
│   │   │   ├── HMMTemporalView.tsx
│   │   │   ├── SourceBadge.tsx
│   │   │   ├── TooltipBadge.tsx
│   │   │   └── GuidedWorkflow/
│   │   │       ├── Step1CaseDetails.tsx
│   │   │       ├── Step2PeopleInvolved.tsx
│   │   │       ├── Step3EvidenceUpload.tsx
│   │   │       ├── Step4EvidenceReview.tsx
│   │   │       ├── Step6ResultsTimeline.tsx
│   │   │       └── Step7ReportsExport.tsx
│   │   ├── utils/
│   │   │   ├── timeUtils.ts
│   │   │   └── tooltips.ts
│   │   ├── test/
│   │   │   ├── setup.ts
│   │   │   └── app.test.tsx      # Vitest frontend test suite
│   │   ├── api.ts
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── start_both.ps1                # Single PowerShell script to start backend + frontend
└── README.md
```

---

## Quick Start (Windows PowerShell)

### Option A: Single Command ("Start Both")
From the project root (`c:\Users\chidv\Downloads\CrimeSceneReconstruction_New`):

```powershell
.\start_both.ps1
```

### Option B: Manual Step-by-Step Commands (Windows PowerShell)

#### 1. Backend Setup & Run (Port 8000)
```powershell
cd c:\Users\chidv\Downloads\CrimeSceneReconstruction_New\backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*(Note: On this machine, Anaconda Python with `pgmpy 1.1.2` is at `C:\Users\chidv\anaconda3\python.exe`.)*

#### 2. Frontend Setup & Run (Port 5173)
Open a second PowerShell terminal:
```powershell
cd c:\Users\chidv\Downloads\CrimeSceneReconstruction_New\frontend
npm install
npm run dev
```
Then open **http://localhost:5173** in your browser.

---

## Running Tests

### Backend Tests (pytest)
```powershell
cd c:\Users\chidv\Downloads\CrimeSceneReconstruction_New\backend
$env:PYTHONPATH = "."
pytest tests/test_api.py -v
```

### Frontend Tests (Vitest)
```powershell
cd c:\Users\chidv\Downloads\CrimeSceneReconstruction_New\frontend
npm run test
```
