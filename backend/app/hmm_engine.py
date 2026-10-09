from typing import Dict, Any, List, Optional
import joblib
import numpy as np
import pandas as pd

from .config import HMM_MODEL_PATH, HMM_STATES_PATH
from .lookups import MONTH_NAMES

HMM_SCOPE_NOTICE = (
    "The Hidden Markov Model (HMM) describes regional burglary activity levels across "
    "months and 6-hour time periods. It does NOT model minute-level timelines or individual suspect behaviour."
)

STATE_DEFINITIONS: Dict[int, Dict[str, str]] = {
    0: {
        "name": "Low Activity",
        "short": "Low",
        "color": "#10b981",  # Emerald
        "description": "Below-average regional burglary volume for the 6-hour period (bottom tertile of historical counts).",
    },
    1: {
        "name": "Medium Activity",
        "short": "Medium",
        "color": "#f59e0b",  # Amber
        "description": "Moderate regional burglary volume near the annual baseline mean.",
    },
    2: {
        "name": "High Activity",
        "short": "High",
        "color": "#ef4444",  # Red/Coral
        "description": "Elevated regional burglary volume (top tertile of historical counts, typically Afternoon and summer/autumn Evenings).",
    },
}

PERIOD_ORDER = ["Morning", "Afternoon", "Evening", "Night"]


class HMMEngine:
    """Loads burglary_hmm_model.pkl and burglary_hmm_states.csv following hmm_inference.py.py."""

    def __init__(self) -> None:
        self.model_data: Dict[str, Any] = joblib.load(HMM_MODEL_PATH)
        self.states_df: pd.DataFrame = pd.read_csv(HMM_STATES_PATH)

        self.n_states: int = int(self.model_data["n_states"])
        self.state_means: np.ndarray = np.asarray(self.model_data["state_means"], dtype=float)
        self.transition_matrix: np.ndarray = np.asarray(
            self.model_data["transition_matrix"], dtype=float
        )
        self.initial_probability: np.ndarray = np.asarray(
            self.model_data["initial_probability"], dtype=float
        )
        self.overall_mean: float = float(self.model_data.get("mean", self.states_df["crime_count"].mean()))
        self.overall_std: float = float(self.model_data.get("std", self.states_df["crime_count"].std()))

    def get_overview(self) -> Dict[str, Any]:
        """Return full HMM states, transition matrix, 12x4 month x time_period grid, and summary stats."""
        dist = (
            self.states_df["hidden_state"]
            .value_counts(normalize=True)
            .sort_index()
        )
        counts = (
            self.states_df["hidden_state"]
            .value_counts()
            .sort_index()
        )

        states_info = []
        for s in range(self.n_states):
            meta = STATE_DEFINITIONS[s]
            states_info.append(
                {
                    "state": s,
                    "name": meta["name"],
                    "short": meta["short"],
                    "color": meta["color"],
                    "description": meta["description"],
                    "mean_crime_count": round(float(self.state_means[s]), 2),
                    "observation_count": int(counts.get(s, 0)),
                    "proportion": round(float(dist.get(s, 0.0)), 4),
                    "initial_probability": round(float(self.initial_probability[s]), 4),
                }
            )

        transition_rows = []
        for i in range(self.n_states):
            row_probs = [round(float(self.transition_matrix[i, j]), 4) for j in range(self.n_states)]
            transition_rows.append(
                {
                    "from_state": i,
                    "from_name": STATE_DEFINITIONS[i]["name"],
                    "to_probabilities": row_probs,
                    "transitions": [
                        {
                            "to_state": j,
                            "to_name": STATE_DEFINITIONS[j]["name"],
                            "probability": row_probs[j],
                        }
                        for j in range(self.n_states)
                    ],
                }
            )

        # Build 12 x 4 grid (Month 1..12 x [Morning, Afternoon, Evening, Night])
        grid_months = []
        for month_num in range(1, 13):
            m_str = str(month_num)
            m_df = self.states_df[self.states_df["incident_month"] == month_num]
            periods_map: Dict[str, Any] = {}
            for p in PERIOD_ORDER:
                p_row = m_df[m_df["time_period"] == p]
                if not p_row.empty:
                    r = p_row.iloc[0]
                    st_id = int(r["hidden_state"])
                    c_count = int(r["crime_count"])
                    periods_map[p] = {
                        "month": month_num,
                        "month_name": MONTH_NAMES.get(m_str, f"Month {month_num}"),
                        "time_period": p,
                        "crime_count": c_count,
                        "hidden_state": st_id,
                        "state_name": STATE_DEFINITIONS[st_id]["name"],
                        "state_short": STATE_DEFINITIONS[st_id]["short"],
                        "color": STATE_DEFINITIONS[st_id]["color"],
                    }
            grid_months.append(
                {
                    "month": month_num,
                    "month_name": MONTH_NAMES.get(m_str, f"Month {month_num}"),
                    "periods": periods_map,
                }
            )

        last_row = self.states_df.iloc[-1]
        last_state = int(last_row["hidden_state"])
        next_probs = self.transition_matrix[last_state]
        predicted_next = int(np.argmax(next_probs))

        return {
            "n_states": self.n_states,
            "overall_mean_count": round(self.overall_mean, 2),
            "overall_std_count": round(self.overall_std, 2),
            "total_observations": len(self.states_df),
            "period_order": PERIOD_ORDER,
            "states": states_info,
            "transition_matrix": self.transition_matrix.tolist(),
            "transition_rows": transition_rows,
            "initial_probability": self.initial_probability.tolist(),
            "grid": grid_months,
            "sequence_prediction": {
                "last_observed_month": int(last_row["incident_month"]),
                "last_observed_period": str(last_row["time_period"]),
                "last_state": last_state,
                "last_state_name": STATE_DEFINITIONS[last_state]["name"],
                "next_state_probabilities": [
                    {
                        "state": s,
                        "name": STATE_DEFINITIONS[s]["name"],
                        "probability": round(float(next_probs[s]), 4),
                    }
                    for s in range(self.n_states)
                ],
                "predicted_next_state": predicted_next,
                "predicted_next_state_name": STATE_DEFINITIONS[predicted_next]["name"],
            },
            "scope_notice": HMM_SCOPE_NOTICE,
        }

    def estimate_cell(self, month: Optional[int], time_period: Optional[str]) -> Dict[str, Any]:
        """
        Look up the HMM hidden-state estimate for a given (month, time_period) cell
        and return a plain-English regional activity explanation.
        """
        if month is None or not (1 <= int(month) <= 12):
            raise ValueError("Month must be an integer between 1 (January) and 12 (December).")

        month_int = int(month)
        month_name = MONTH_NAMES.get(str(month_int), f"Month {month_int}")

        if not time_period or time_period == "Unknown":
            # Summarize across all 4 periods of that month when time_period is Unknown
            m_df = self.states_df[self.states_df["incident_month"] == month_int]
            period_cells = []
            for p in PERIOD_ORDER:
                pr = m_df[m_df["time_period"] == p]
                if not pr.empty:
                    row = pr.iloc[0]
                    st = int(row["hidden_state"])
                    period_cells.append(
                        {
                            "time_period": p,
                            "crime_count": int(row["crime_count"]),
                            "hidden_state": st,
                            "state_name": STATE_DEFINITIONS[st]["name"],
                            "color": STATE_DEFINITIONS[st]["color"],
                        }
                    )
            return {
                "month": month_int,
                "month_name": month_name,
                "time_period": "Unknown",
                "is_unknown_period": True,
                "month_breakdown": period_cells,
                "explanation": (
                    f"Because the exact 6-hour time period in {month_name} is marked as Unknown, "
                    f"the HMM cannot pinpoint a single period cell. Across {month_name}, regional activity ranges "
                    f"from {min(c['crime_count'] for c in period_cells)} incidents ({min(period_cells, key=lambda x: x['crime_count'])['time_period']}) "
                    f"to {max(c['crime_count'] for c in period_cells)} incidents ({max(period_cells, key=lambda x: x['crime_count'])['time_period']})."
                ),
                "scope_notice": HMM_SCOPE_NOTICE,
            }

        if time_period not in PERIOD_ORDER:
            raise ValueError(
                f"Invalid time_period '{time_period}'. Must be one of: {', '.join(PERIOD_ORDER)}, or 'Unknown'."
            )

        match = self.states_df[
            (self.states_df["incident_month"] == month_int)
            & (self.states_df["time_period"] == time_period)
        ]
        if match.empty:
            raise ValueError(f"No HMM observation found for month={month_int}, time_period={time_period}.")

        row = match.iloc[0]
        state_id = int(row["hidden_state"])
        crime_count = int(row["crime_count"])
        state_meta = STATE_DEFINITIONS[state_id]
        state_mean = float(self.state_means[state_id])

        next_probs = self.transition_matrix[state_id]
        most_likely_next = int(np.argmax(next_probs))

        diff_vs_overall = crime_count - self.overall_mean
        direction = "above" if diff_vs_overall >= 0 else "below"

        explanation = (
            f"In {month_name} during the {time_period} window, the regional burglary regime is classified as "
            f"State {state_id} ({state_meta['name']}), with {crime_count} recorded incidents in the historical dataset "
            f"({abs(diff_vs_overall):.0f} incidents {direction} the overall period average of {self.overall_mean:.1f}, "
            f"and close to the {state_meta['name']} mean of {state_mean:.1f}). "
            f"From {state_meta['name']}, the model's transition matrix indicates a {next_probs[most_likely_next] * 100:.1f}% "
            f"probability of transitioning to {STATE_DEFINITIONS[most_likely_next]['name']} in the next sequential time window."
        )

        return {
            "month": month_int,
            "month_name": month_name,
            "time_period": time_period,
            "is_unknown_period": False,
            "crime_count": crime_count,
            "hidden_state": state_id,
            "state_name": state_meta["name"],
            "state_short": state_meta["short"],
            "color": state_meta["color"],
            "state_mean": round(state_mean, 2),
            "overall_mean": round(self.overall_mean, 2),
            "next_state_probabilities": [
                {
                    "state": s,
                    "name": STATE_DEFINITIONS[s]["name"],
                    "short": STATE_DEFINITIONS[s]["short"],
                    "probability": round(float(next_probs[s]), 4),
                }
                for s in range(self.n_states)
            ],
            "predicted_next_state": most_likely_next,
            "predicted_next_state_name": STATE_DEFINITIONS[most_likely_next]["name"],
            "explanation": explanation,
            "scope_notice": HMM_SCOPE_NOTICE,
        }


hmm_engine = HMMEngine()
