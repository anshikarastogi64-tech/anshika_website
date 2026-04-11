/**
 * Project meetings: Google Calendar “Add to calendar” template URLs and form parsing.
 * Automated Google Meet links require Google Calendar API (Workspace / service account) — see .env.example.
 */

function parseStartAndDuration(startLocal, durationMinutes) {
  const d = String(startLocal || '').trim();
  const dur = Math.min(480, Math.max(15, parseInt(durationMinutes, 10) || 60));
  const start = new Date(d);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + dur * 60 * 1000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    durationMinutes: dur,
  };
}

/** Google Calendar “create event” prefilled form (user adds Google Meet in the event UI). */
function buildGoogleCalendarTemplateUrl({ title, startIso, endIso, details }) {
  const fmt = (iso) => {
    const x = new Date(iso);
    if (Number.isNaN(x.getTime())) return '';
    return x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };
  const s = fmt(startIso);
  const e = fmt(endIso);
  if (!s || !e) return '';
  const text = encodeURIComponent(String(title || 'Meeting').slice(0, 500));
  const det = encodeURIComponent(String(details || '').slice(0, 2000));
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${s}/${e}&details=${det}`;
}

function looksLikeHttpUrl(s) {
  const u = String(s || '').trim();
  if (!u) return false;
  try {
    const p = new URL(u);
    return p.protocol === 'https:' || p.protocol === 'http:';
  } catch {
    return false;
  }
}

module.exports = {
  parseStartAndDuration,
  buildGoogleCalendarTemplateUrl,
  looksLikeHttpUrl,
};
