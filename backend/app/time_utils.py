from datetime import datetime
from typing import Optional, List, Dict, Any
import re

TIME_REGEX = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")

PERIOD_BINS = [
    ("Night", 0, 5, "00:00–05:59"),
    ("Morning", 6, 11, "06:00–11:59"),
    ("Afternoon", 12, 17, "12:00–17:59"),
    ("Evening", 18, 23, "18:00–23:59"),
]


def parse_hhmm(time_str: str, field_label: str = "Incident time") -> tuple[int, int]:
    """Validate and parse an HH:MM 24-hour time string."""
    if not time_str or not isinstance(time_str, str):
        raise ValueError(f"{field_label} is required and must be in HH:MM (24-hour) format.")
    cleaned = time_str.strip()
    match = TIME_REGEX.match(cleaned)
    if not match:
        raise ValueError(
            f"Invalid {field_label.lower()} '{time_str}'. Please enter a valid 24-hour time between 00:00 and 23:59."
        )
    return int(match.group(1)), int(match.group(2))


def hour_to_time_period(hour: Optional[int]) -> str:
    """Map an integer hour (0-23) to the BN 6-hour time_period state."""
    if hour is None:
        return "Unknown"
    if not (0 <= hour <= 23):
        raise ValueError(f"Hour must be between 0 and 23, got {hour}.")
    if 0 <= hour < 6:
        return "Night"
    elif 6 <= hour < 12:
        return "Morning"
    elif 12 <= hour < 18:
        return "Afternoon"
    else:
        return "Evening"


def get_spanned_periods(start_str: str, end_str: str) -> List[str]:
    """
    Determine all 6-hour time periods touched by a time range [start_str, end_str].
    Supports overnight ranges (e.g., 22:30 to 02:15 -> ['Evening', 'Night']).
    """
    sh, sm = parse_hhmm(start_str, "Range start time")
    eh, em = parse_hhmm(end_str, "Range end time")

    start_min = sh * 60 + sm
    end_min = eh * 60 + em
    if end_min < start_min:
        # Overnight wrap-around
        end_min += 24 * 60

    spanned: List[str] = []
    # Check each minute in the inclusive range to accurately capture all periods
    for m in range(start_min, end_min + 1):
        norm_min = m % (24 * 60)
        hr = norm_min // 60
        period = hour_to_time_period(hr)
        if period not in spanned:
            spanned.append(period)

    return spanned


def parse_incident_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse YYYY-MM-DD or DD MMM YYYY date string."""
    if not date_str or not str(date_str).strip():
        return None
    cleaned = str(date_str).strip()
    for fmt in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
    raise ValueError(
        f"Invalid incident date '{date_str}'. Please enter a valid date in YYYY-MM-DD format (e.g., 2026-10-09)."
    )


def map_incident_datetime(
    incident_date: Optional[str] = None,
    incident_time: Optional[str] = None,
    time_precision: str = "Exact",
    time_range_start: Optional[str] = None,
    time_range_end: Optional[str] = None,
    range_resolution: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Map investigator-entered date, minute-level time, precision, and optional range
    into Bayesian Network evidence variables without inventing fake times or silently
    collapsing multi-period time ranges.

    range_resolution options when a range spans multiple periods:
      - None: do not collapse; flag spans_multiple_periods=True and provide scenario options
      - "unknown": set time_period="Unknown" in BN evidence
      - "unobserved": leave time_period out of BN evidence (marginalise over all periods)
      - "compare": keep time_period out of single-run evidence and return scenarios per period
    """
    valid_precisions = {"Exact", "Approximate", "Time Unknown"}
    if time_precision not in valid_precisions:
        raise ValueError(
            f"Invalid time precision '{time_precision}'. Must be one of: Exact, Approximate, Time Unknown."
        )

    dt = parse_incident_date(incident_date)
    incident_month: Optional[str] = None
    day_type: Optional[str] = None
    day_of_week: Optional[str] = None
    formatted_date: Optional[str] = None

    if dt is not None:
        incident_month = str(dt.month)
        day_of_week = dt.strftime("%A")
        day_type = "Weekend" if dt.weekday() >= 5 else "Weekday"
        formatted_date = dt.strftime("%d %b %Y")

    derived_time_period: Optional[str] = None
    spanned_periods: List[str] = []
    spans_multiple_periods = False
    warning_message: Optional[str] = None
    display_time_part = "Time Unknown"

    if time_precision == "Time Unknown":
        display_time_part = "Time Unknown"
        if range_resolution == "unobserved":
            derived_time_period = None
        else:
            derived_time_period = "Unknown"
    elif time_precision == "Exact":
        if not incident_time:
            raise ValueError("Please enter an Incident Time (HH:MM) when Time Precision is set to Exact, or switch to Time Unknown.")
        hr, mn = parse_hhmm(incident_time, "Incident time")
        derived_time_period = hour_to_time_period(hr)
        spanned_periods = [derived_time_period]
        display_time_part = f"{hr:02d}:{mn:02d}"
    elif time_precision == "Approximate":
        has_range = bool(time_range_start and str(time_range_start).strip()) and bool(
            time_range_end and str(time_range_end).strip()
        )
        if has_range:
            spanned_periods = get_spanned_periods(str(time_range_start), str(time_range_end))
            sh, sm = parse_hhmm(str(time_range_start), "Range start time")
            eh, em = parse_hhmm(str(time_range_end), "Range end time")
            display_time_part = f"Approx. {sh:02d}:{sm:02d}–{eh:02d}:{em:02d}"

            if len(spanned_periods) == 1:
                derived_time_period = spanned_periods[0]
            else:
                spans_multiple_periods = True
                warning_message = (
                    f"The approximate range {sh:02d}:{sm:02d}–{eh:02d}:{em:02d} spans multiple 6-hour model periods "
                    f"({', '.join(spanned_periods)}). It is not collapsed silently: choose whether to set Time Period "
                    f"as Unknown, leave it unobserved, or compare one scenario per spanned period."
                )
                if range_resolution == "unknown":
                    derived_time_period = "Unknown"
                elif range_resolution in ("unobserved", "compare", None):
                    derived_time_period = None
                elif range_resolution in spanned_periods:
                    derived_time_period = range_resolution
        elif incident_time and str(incident_time).strip():
            hr, mn = parse_hhmm(str(incident_time), "Approximate incident time")
            derived_time_period = hour_to_time_period(hr)
            spanned_periods = [derived_time_period]
            display_time_part = f"~{hr:02d}:{mn:02d} (Approximate)"
        else:
            raise ValueError(
                "For Approximate time, please provide either a Time Range (start and end) or an approximate Incident Time (HH:MM)."
            )

    if formatted_date:
        formatted_display = f"{formatted_date}, {display_time_part}"
    else:
        formatted_display = display_time_part

    bn_evidence: Dict[str, str] = {}
    if incident_month is not None:
        bn_evidence["incident_month"] = incident_month
    if day_type is not None:
        bn_evidence["day_type"] = day_type
    if derived_time_period is not None:
        bn_evidence["time_period"] = derived_time_period

    candidate_scenarios = []
    if spans_multiple_periods:
        for p in spanned_periods:
            scen_ev = dict(bn_evidence)
            scen_ev["time_period"] = p
            candidate_scenarios.append(
                {
                    "name": f"Range in {p} Period",
                    "time_period": p,
                    "evidence": scen_ev,
                }
            )

    return {
        "investigator_entered": {
            "incident_date": incident_date,
            "incident_time": incident_time if time_precision != "Time Unknown" else None,
            "time_precision": time_precision,
            "time_range_start": time_range_start if time_precision == "Approximate" else None,
            "time_range_end": time_range_end if time_precision == "Approximate" else None,
            "formatted_display": formatted_display,
            "label": "Investigator-entered",
        },
        "model_mapping": {
            "incident_month": incident_month,
            "day_of_week": day_of_week,
            "day_type": day_type,
            "time_period": derived_time_period,
            "spanned_periods": spanned_periods,
            "spans_multiple_periods": spans_multiple_periods,
            "range_resolution": range_resolution,
            "bn_evidence": bn_evidence,
            "candidate_scenarios": candidate_scenarios,
            "warning": warning_message,
            "model_note": "The model uses 6-hour time periods.",
        },
    }
