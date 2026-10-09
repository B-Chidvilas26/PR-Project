import { TimeMappingResult } from '../types';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function hourToTimePeriod(hour: number | null | undefined): string {
  if (hour === null || hour === undefined || Number.isNaN(hour)) {
    return 'Unknown';
  }
  if (hour >= 0 && hour < 6) return 'Night';
  if (hour >= 6 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  return 'Evening';
}

export function parseHHMM(timeStr: string | null | undefined, label = 'Incident time'): [number, number] {
  if (!timeStr || !timeStr.trim()) {
    throw new Error(`${label} is required in HH:MM (24-hour) format.`);
  }
  const m = TIME_REGEX.exec(timeStr.trim());
  if (!m) {
    throw new Error(
      `Invalid ${label.toLowerCase()} '${timeStr}'. Please enter a valid 24-hour time between 00:00 and 23:59.`
    );
  }
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

export function getSpannedPeriodsClient(startStr: string, endStr: string): string[] {
  const [sh, sm] = parseHHMM(startStr, 'Range start time');
  const [eh, em] = parseHHMM(endStr, 'Range end time');

  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin < startMin) {
    endMin += 24 * 60;
  }

  const spanned: string[] = [];
  for (let m = startMin; m <= endMin; m++) {
    const norm = m % (24 * 60);
    const hr = Math.floor(norm / 60);
    const p = hourToTimePeriod(hr);
    if (!spanned.includes(p)) {
      spanned.push(p);
    }
  }
  return spanned;
}

export function computeTimeMappingClient(params: {
  incident_date?: string | null;
  incident_time?: string | null;
  time_precision: 'Exact' | 'Approximate' | 'Time Unknown';
  time_range_start?: string | null;
  time_range_end?: string | null;
  range_resolution?: string | null;
}): TimeMappingResult {
  const {
    incident_date = null,
    incident_time = null,
    time_precision = 'Exact',
    time_range_start = null,
    time_range_end = null,
    range_resolution = null,
  } = params;

  let incident_month: string | null = null;
  let day_of_week: string | null = null;
  let day_type: string | null = null;
  let formattedDate: string | null = null;

  if (incident_date && incident_date.trim()) {
    const cleanDate = incident_date.trim();
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanDate);
    if (!parts) {
      throw new Error(
        `Invalid incident date '${incident_date}'. Please use YYYY-MM-DD format (e.g., 2026-10-09).`
      );
    }
    const y = parseInt(parts[1], 10);
    const m = parseInt(parts[2], 10);
    const d = parseInt(parts[3], 10);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() + 1 !== m ||
      dt.getUTCDate() !== d
    ) {
      throw new Error(`Invalid calendar date '${incident_date}'.`);
    }
    incident_month = String(m);
    const dowIdx = dt.getUTCDay();
    day_of_week = DAY_NAMES[dowIdx];
    day_type = dowIdx === 0 || dowIdx === 6 ? 'Weekend' : 'Weekday';
    formattedDate = `${String(d).padStart(2, '0')} ${MONTH_SHORT[m - 1]} ${y}`;
  }

  let derived_time_period: string | null = null;
  let spanned_periods: string[] = [];
  let spans_multiple_periods = false;
  let warning: string | null = null;
  let displayTimePart = 'Time Unknown';

  if (time_precision === 'Time Unknown') {
    displayTimePart = 'Time Unknown';
    derived_time_period = range_resolution === 'unobserved' ? null : 'Unknown';
  } else if (time_precision === 'Exact') {
    if (!incident_time || !incident_time.trim()) {
      throw new Error(
        'Please enter an Incident Time (HH:MM) when Time Precision is Exact, or switch to Time Unknown.'
      );
    }
    const [hr, mn] = parseHHMM(incident_time, 'Incident time');
    derived_time_period = hourToTimePeriod(hr);
    spanned_periods = [derived_time_period];
    displayTimePart = `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
  } else if (time_precision === 'Approximate') {
    const hasRange =
      Boolean(time_range_start && time_range_start.trim()) &&
      Boolean(time_range_end && time_range_end.trim());

    if (hasRange) {
      spanned_periods = getSpannedPeriodsClient(time_range_start!, time_range_end!);
      const [sh, sm] = parseHHMM(time_range_start!, 'Range start time');
      const [eh, em] = parseHHMM(time_range_end!, 'Range end time');
      displayTimePart = `Approx. ${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}–${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

      if (spanned_periods.length === 1) {
        derived_time_period = spanned_periods[0];
      } else {
        spans_multiple_periods = true;
        warning = `The approximate range ${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}–${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')} spans multiple 6-hour periods (${spanned_periods.join(', ')}). It is not collapsed silently: choose whether to set Time Period as Unknown, leave it unobserved, or compare one scenario per spanned period.`;
        if (range_resolution === 'unknown') {
          derived_time_period = 'Unknown';
        } else if (
          range_resolution === 'unobserved' ||
          range_resolution === 'compare' ||
          !range_resolution
        ) {
          derived_time_period = null;
        } else if (spanned_periods.includes(range_resolution)) {
          derived_time_period = range_resolution;
        }
      }
    } else if (incident_time && incident_time.trim()) {
      const [hr, mn] = parseHHMM(incident_time, 'Approximate incident time');
      derived_time_period = hourToTimePeriod(hr);
      spanned_periods = [derived_time_period];
      displayTimePart = `~${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')} (Approximate)`;
    } else {
      throw new Error(
        'For Approximate time, please enter either a Time Range (start and end) or an approximate Incident Time (HH:MM).'
      );
    }
  }

  const formatted_display = formattedDate
    ? `${formattedDate}, ${displayTimePart}`
    : displayTimePart;

  const bn_evidence: Record<string, string> = {};
  if (incident_month) bn_evidence.incident_month = incident_month;
  if (day_type) bn_evidence.day_type = day_type;
  if (derived_time_period) bn_evidence.time_period = derived_time_period;

  const candidate_scenarios = spans_multiple_periods
    ? spanned_periods.map((p) => ({
        name: `Range in ${p} Period`,
        time_period: p,
        evidence: { ...bn_evidence, time_period: p },
      }))
    : [];

  return {
    investigator_entered: {
      incident_date: incident_date || null,
      incident_time: time_precision !== 'Time Unknown' ? incident_time || null : null,
      time_precision,
      time_range_start: time_precision === 'Approximate' ? time_range_start || null : null,
      time_range_end: time_precision === 'Approximate' ? time_range_end || null : null,
      formatted_display,
      label: 'Investigator-entered',
    },
    model_mapping: {
      incident_month,
      day_of_week,
      day_type,
      time_period: derived_time_period,
      spanned_periods,
      spans_multiple_periods,
      range_resolution,
      bn_evidence,
      candidate_scenarios,
      warning,
      model_note: 'The model uses 6-hour time periods.',
    },
  };
}
