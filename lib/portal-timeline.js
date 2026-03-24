/**
 * Calendar date helpers for project design & execution timelines (YYYY-MM-DD).
 */
function addCalendarDays(isoDateStr, deltaDays) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return null;
  const parts = isoDateStr.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(deltaDays));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive span: 15 days from Jan 1 → ends Jan 15 */
function endDateFromStartAndDuration(startIso, durationDays) {
  const n = Math.max(1, parseInt(durationDays, 10) || 1);
  return addCalendarDays(startIso, n - 1);
}

function isValidISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addCalendarDays(s, 0) !== null;
}

function compareISODates(a, b) {
  if (!isValidISODate(a) || !isValidISODate(b)) return 0;
  return a.localeCompare(b);
}

/** Inclusive calendar days from start through end (both ends counted). */
function inclusiveDayCount(startIso, endIso) {
  if (!isValidISODate(startIso) || !isValidISODate(endIso)) return null;
  if (compareISODates(endIso, startIso) < 0) return null;
  const a = startIso.split('-').map((n) => parseInt(n, 10));
  const b = endIso.split('-').map((n) => parseInt(n, 10));
  const d0 = new Date(a[0], a[1] - 1, a[2]);
  const d1 = new Date(b[0], b[1] - 1, b[2]);
  return Math.round((d1 - d0) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * End date after approved extensions: baseline planned end + sum(extra_days), calendar arithmetic.
 * Baseline (project.design_timeline_end / execution_timeline_end) is not mutated when extensions approve.
 */
function effectivePhaseEndDate(baselineEndIso, approvedExtensionsForPhase) {
  if (!isValidISODate(baselineEndIso)) return null;
  const list = Array.isArray(approvedExtensionsForPhase) ? approvedExtensionsForPhase : [];
  let total = 0;
  list.forEach((e) => {
    total += Math.max(0, parseInt(e.extra_days, 10) || 0);
  });
  if (total === 0) return baselineEndIso;
  return addCalendarDays(baselineEndIso, total);
}

/** Today's calendar date in local timezone (YYYY-MM-DD). */
function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  addCalendarDays,
  endDateFromStartAndDuration,
  isValidISODate,
  compareISODates,
  inclusiveDayCount,
  effectivePhaseEndDate,
  todayLocalISO,
};
