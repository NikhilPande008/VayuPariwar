import type {
  HourlyAqiPoint,
  HourlyAqiPointInput,
  SafeWindowResult,
  TimeWindow,
} from "@/types";

const MAX_WINDOW_SIZE_HOURS = 3;
const WAKING_START_HOUR = 6;
const WAKING_END_HOUR = 21;

/**
 * Formats an hour (0-24) into a concise 12-hour label, e.g. 6 -> "6:00 AM", 15 -> "3:00 PM".
 */
export function formatHourLabel(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) return "12:00 AM";
  if (normalized === 12) return "12:00 PM";
  if (normalized < 12) return `${normalized}:00 AM`;
  return `${normalized - 12}:00 PM`;
}

/**
 * Formats a window range, e.g. (14, 17) -> "2:00 PM - 5:00 PM".
 */
export function formatWindowRange(startHour: number, endHour: number): string {
  return `${formatHourLabel(startHour)} - ${formatHourLabel(endHour)}`;
}

function buildWindow(slice: readonly HourlyAqiPoint[]): TimeWindow {
  const first = slice[0];
  if (!first) {
    throw new Error("Cannot build a time window from an empty slice.");
  }
  const sum = slice.reduce((acc, point) => acc + point.pm25, 0);
  const avgPm25 = Math.round((sum / slice.length) * 10) / 10;
  const startHour = first.hour;
  const endHour = (startHour + slice.length) % 24;

  return {
    startHour,
    endHour,
    label: formatWindowRange(startHour, endHour),
    avgPm25,
  };
}

/**
 * Scans hourly PM2.5 readings using a 3-hour sliding window (gracefully scaling down
 * for incomplete arrays with 1-2 valid points and skipping null/NaN/negative slots):
 * - bestWindow: lowest average PM2.5 during waking hours (06:00-21:00), falling back
 *   to available windows when fewer than 3 waking hours are present.
 * - peakWindow: highest average PM2.5 across all available hours.
 * - reductionPercent: percentage drop from peakWindow to bestWindow (0 on flat curves).
 */
export function detectSafeWindow(
  hourly: readonly (HourlyAqiPoint | HourlyAqiPointInput)[]
): SafeWindowResult {
  const validPoints: HourlyAqiPoint[] = [];

  for (const point of hourly) {
    if (
      point.pm25 === null ||
      point.pm25 === undefined ||
      typeof point.pm25 !== "number" ||
      !Number.isFinite(point.pm25) ||
      point.pm25 < 0
    ) {
      continue;
    }

    validPoints.push({
      time: point.time,
      hour: ((Math.floor(point.hour) % 24) + 24) % 24,
      pm25: point.pm25,
      ...(typeof point.pm10 === "number" &&
      Number.isFinite(point.pm10) &&
      point.pm10 >= 0
        ? { pm10: point.pm10 }
        : {}),
    });
  }

  if (validPoints.length === 0) {
    throw new Error(
      "At least one valid hourly PM2.5 reading is required to detect safe windows."
    );
  }

  const windowSize = Math.min(MAX_WINDOW_SIZE_HOURS, validPoints.length);
  const allWindows: TimeWindow[] = [];
  const wakingWindows: TimeWindow[] = [];

  for (let i = 0; i <= validPoints.length - windowSize; i += 1) {
    const slice = validPoints.slice(i, i + windowSize);
    const window = buildWindow(slice);
    allWindows.push(window);

    // Waking window covers 06:00 through 21:00 inclusive
    const spanEnd = window.startHour + windowSize;
    if (window.startHour >= WAKING_START_HOUR && spanEnd <= WAKING_END_HOUR) {
      wakingWindows.push(window);
    }
  }

  const bestCandidates = wakingWindows.length > 0 ? wakingWindows : allWindows;

  let bestWindow = bestCandidates[0];
  let peakWindow = allWindows[0];

  if (!bestWindow || !peakWindow) {
    throw new Error("Unable to compute windows from hourly data.");
  }

  for (const candidate of bestCandidates) {
    if (candidate.avgPm25 < bestWindow.avgPm25) {
      bestWindow = candidate;
    }
  }

  for (const candidate of allWindows) {
    if (candidate.avgPm25 > peakWindow.avgPm25) {
      peakWindow = candidate;
    }
  }

  const reductionPercent =
    peakWindow.avgPm25 > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((peakWindow.avgPm25 - bestWindow.avgPm25) /
                peakWindow.avgPm25) *
                100
            )
          )
        )
      : 0;

  return {
    bestWindow,
    peakWindow,
    reductionPercent,
  };
}
