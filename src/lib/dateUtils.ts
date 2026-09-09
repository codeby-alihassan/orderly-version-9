/**
 * Date and Time utilities for Orderly POS.
 * Ensures all dates change strictly at 12:00 AM local browser midnight,
 * and converts local calendar dates to exact ISO timestamps for database queries.
 */

// Returns "YYYY-MM-DD" based on local time
export function formatLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Returns start of local day in ISO string (00:00:00.000 local time)
export function getLocalStartOfDayISO(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return d.toISOString();
}

// Returns end of local day in ISO string (23:59:59.999 local time)
export function getLocalEndOfDayISO(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return d.toISOString();
}

// Converts a user-selected local date string "YYYY-MM-DD" to exact start and end ISO bounds
export function dateStringToLocalRangeISO(dateStr: string): { startIso: string; endIso: string } {
  if (!dateStr || !dateStr.includes('-')) {
    const now = new Date();
    return {
      startIso: getLocalStartOfDayISO(now),
      endIso: getLocalEndOfDayISO(now),
    };
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

// Formats date nicely for display, e.g. "Saturday, Sep 5, 2026"
export function formatDisplayDate(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Formats short date for compact display, e.g. "Sat, Sep 5"
export function formatCompactDate(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Formats local time with seconds in 12-hour format, e.g. "01:35:42 PM"
export function formatDisplayTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

// Formats local time in standard 12-hour AM/PM format, e.g. "1:35 PM" or "01:35:42 PM"
export function format12HourTime(
  dateInput: Date | string | number | null | undefined,
  includeSeconds = false
): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  });
}

// Formats date and 12-hour time, e.g. "Sep 7, 2026, 1:35 PM"
export function format12HourDateTime(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
