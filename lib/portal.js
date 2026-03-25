/**
 * Portal constants and helpers (Luxury Interior CRM)
 * Specs: portal-master-v18, PORTAL_V18_FINAL_LIFECYCLE
 */

const crypto = require('crypto');

function uuid() {
  return crypto.randomBytes(16).toString('hex');
}

/** Interior project lifecycle (names drive portal UI and stored indices). */
const NUM_LIFECYCLE_STAGES = 18;

const LIFECYCLE_STAGES = [
  { index: 0, name: 'Onboarding', description: 'Briefing, contract signing, and portal setup.' },
  { index: 1, name: 'Site Survey', description: 'Measurement and structural analysis.' },
  { index: 2, name: 'Design Concept Development', description: 'Concept direction, mood, and design development.' },
  { index: 3, name: '2D Space Planning', description: 'Detailed layouts, zoning, and furniture placement.' },
  { index: 4, name: '3D Visualization', description: 'Photorealistic renders and design visualization.' },
  { index: 5, name: '2D Ceiling Planning', description: 'Ceiling layout and detail drawings.' },
  { index: 6, name: 'Electrical Drawings', description: 'Power, lighting, and electrical planning drawings.' },
  { index: 7, name: 'Ceiling Execution', description: 'On-site ceiling installation and finishing.' },
  { index: 8, name: 'Material Selection', description: 'Finalizing finishes, fabrics, fixtures, and hardware.' },
  { index: 9, name: '2D Furniture Drawings', description: 'Joinery, cabinetry, and furniture technical drawings.' },
  { index: 10, name: 'Electrical Wiring', description: 'Rough-in, cabling, and electrical termination.' },
  { index: 11, name: 'Fixed Furniture Execution', description: 'Built-in carpentry and fixed furniture installation.' },
  { index: 12, name: 'Loose Furniture Installation', description: 'Placement and setup of movable furniture.' },
  { index: 13, name: 'Lighting & Fan Installation', description: 'Light fixtures, fans, and related fittings.' },
  { index: 14, name: 'Final Painting', description: 'Final paint coats and surface finishing.' },
  { index: 15, name: 'Final Furniture Touch-Up', description: 'Adjustments, hardware, and furniture detailing.' },
  { index: 16, name: 'Decoration & Styling Phase', description: 'Soft furnishings, accessories, and styling.' },
  { index: 17, name: 'Grand Handover', description: 'Quality audit, snag list, and key handover.' },
];

/** Parse JSON array of stage indices from DB column (null/undefined = not set). */
function parseLifecycleStagesJson(raw, maxExclusive = NUM_LIFECYCLE_STAGES) {
  if (raw == null || raw === '') return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x < maxExclusive))].sort(
      (a, b) => a - b
    );
  } catch (_) {
    return [];
  }
}

/**
 * Attaches lifecycle_completed and lifecycle_active (number[]) for templates.
 * If DB columns are both NULL (never saved), derives from legacy current_stage once in memory.
 */
function enrichProjectLifecycle(project) {
  if (!project) return project;
  const n = LIFECYCLE_STAGES.length;
  const dbUnset = project.lifecycle_completed_stages == null && project.lifecycle_active_stages == null;
  let completed = parseLifecycleStagesJson(project.lifecycle_completed_stages, n);
  let active = parseLifecycleStagesJson(project.lifecycle_active_stages, n);
  if (dbUnset) {
    const cs = Math.min(Math.max(Number(project.current_stage) || 0, 0), n - 1);
    completed = [];
    for (let i = 0; i < cs; i++) completed.push(i);
    active = [cs];
  }
  active = active.filter((i) => !completed.includes(i));
  project.lifecycle_completed = completed;
  project.lifecycle_active = active;
  return project;
}

/** Single-line summary for dashboards (ongoing names, else hint). */
function lifecycleHeadline(project) {
  enrichProjectLifecycle(project);
  if (project.lifecycle_active.length) {
    return project.lifecycle_active
      .map((i) => LIFECYCLE_STAGES[i] && LIFECYCLE_STAGES[i].name)
      .filter(Boolean)
      .join(', ');
  }
  if (project.lifecycle_completed.length) {
    return `${project.lifecycle_completed.length} stage(s) completed`;
  }
  return 'Not started';
}

/** Default milestone schedule — percentages sum to 100%; every row is % of contract total (approved quotation + approved extras). */
const DEFAULT_PAYMENT_TERMS_ITEMS = [
  { label: 'Booking amount', percent: 5, basis: 'TOTAL' },
  { label: 'On quotation closure', percent: 10, basis: 'TOTAL' },
  { label: 'After design sign-off, before production', percent: 40, basis: 'TOTAL' },
  { label: 'After material deployment and before installation', percent: 20, basis: 'TOTAL' },
  { label: '1st payment (during carcase installation)', percent: 10, basis: 'TOTAL' },
  { label: '2nd payment (during shutter dispatch)', percent: 10, basis: 'TOTAL' },
  { label: 'Last payment (handover)', percent: 5, basis: 'TOTAL' },
];

function cloneDefaultPaymentTerms() {
  return {
    intro: '',
    items: DEFAULT_PAYMENT_TERMS_ITEMS.map((x) => ({
      label: x.label,
      percent: x.percent,
      basis: x.basis,
      dueDate: x.dueDate != null ? x.dueDate : null,
    })),
  };
}

function normalizePaymentTermDueDate(raw) {
  if (raw == null || raw === '') return null;
  const d = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/**
 * Parse stored JSON for payment terms; null/empty uses studio default.
 * @returns {{ intro: string, items: Array<{label: string, percent: number, basis: 'TOTAL', dueDate: string|null}> }}
 */
function parsePaymentTermsJson(raw) {
  const fallback = cloneDefaultPaymentTerms();
  if (raw == null || raw === '') return fallback;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return fallback;
    const intro = obj.intro != null ? String(obj.intro).trim() : '';
    if (!Array.isArray(obj.items) || obj.items.length === 0) {
      return { intro, items: fallback.items.map((x) => ({ ...x })) };
    }
    const items = obj.items
      .map((x) => {
        if (!x || typeof x.label !== 'string' || !String(x.label).trim()) return null;
        const pct = Number(x.percent);
        if (Number.isNaN(pct)) return null;
        return {
          label: String(x.label).trim(),
          percent: Math.min(100, Math.max(0, pct)),
          basis: 'TOTAL',
          dueDate: normalizePaymentTermDueDate(x.dueDate),
        };
      })
      .filter(Boolean);
    let out = items.length ? items.map((x) => ({ ...x })) : fallback.items.map((x) => ({ ...x }));
    const sum = sumPaymentTermsPercents(out);
    const hasHandover = out.some((row) => /handover/i.test(row.label));
    // Older app default was 6 milestones totalling 95% (no handover row). Merge the 7th so UI & schedule stay correct.
    if (out.length === 6 && !hasHandover && sum >= 93.5 && sum <= 95.5) {
      const gap = Math.round((100 - sum) * 100) / 100;
      out.push({ label: 'Last payment (handover)', percent: gap, basis: 'TOTAL', dueDate: null });
    }
    out = out.map((row) => ({ ...row, basis: 'TOTAL' }));
    return { intro, items: out };
  } catch (_) {
    return fallback;
  }
}

function sumPaymentTermsPercents(items) {
  return (items || []).reduce((s, row) => s + (Number(row.percent) || 0), 0);
}

/**
 * Allocate published payments across milestones in order (waterfall).
 * @returns {{ stages: Array, quotationBase: number, contractTotal: number, variationAmount: number, totalPaid: number }}
 */
function computePaymentMilestoneAllocations({ items, quotationBase, contractTotal, publishedPayments }) {
  const qb = Number(quotationBase) || 0;
  const ct = Number(contractTotal) || 0;
  const list = items || [];
  const payments = (publishedPayments || [])
    .filter((p) => Number(p.amount) > 0)
    .slice()
    .sort((a, b) => {
      const da = `${String(a.received_date || '')}\t${String(a.created_at || '')}`;
      const db = `${String(b.received_date || '')}\t${String(b.created_at || '')}`;
      return da.localeCompare(db);
    });
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const stages = [];
  let cumulativeEnd = 0;
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const targetAmount = (ct * (Number(row.percent) || 0)) / 100;
    const start = cumulativeEnd;
    const end = cumulativeEnd + targetAmount;
    cumulativeEnd = end;
    const paidInto = Math.max(0, Math.min(totalPaid, end) - Math.min(totalPaid, start));
    const remaining = Math.max(0, targetAmount - paidInto);
    let status = 'PENDING';
    if (targetAmount <= 0.005) status = 'PAID';
    else if (paidInto >= targetAmount - 0.005) status = 'PAID';
    else if (paidInto > 0.005) status = 'PARTIAL';
    stages.push({
      index: i,
      label: row.label,
      percent: row.percent,
      basis: 'TOTAL',
      dueDate: row.dueDate || null,
      targetAmount,
      allocated: paidInto,
      remaining,
      status,
    });
  }
  return {
    stages,
    quotationBase: qb,
    contractTotal: ct,
    variationAmount: Math.max(0, ct - qb),
    totalPaid,
  };
}

function fingerprintPaymentSchedule(result) {
  const payload = {
    qb: result.quotationBase,
    ct: result.contractTotal,
    rows: result.stages.map((s) => ({
      l: s.label,
      p: s.percent,
      b: s.basis,
      d: s.dueDate,
      t: Math.round(s.targetAmount * 100) / 100,
      st: s.status,
      a: Math.round(s.allocated * 100) / 100,
    })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Full notification line including project title. */
function buildPaymentScheduleNotifyMessage(projectTitle, result) {
  const title = projectTitle || 'Your project';
  const next = result.stages.find((s) => s.status !== 'PAID');
  if (!next) {
    return `«${title}»: every milestone in your payment schedule shows as satisfied from the amounts we’ve shared with you. Thank you for staying current with your design journey.`;
  }
  if (next.status === 'PARTIAL') {
    return `«${title}»: «${next.label}» is partly paid — ₹${Math.round(next.remaining).toLocaleString('en-IN')} remains to complete this stage. Open Finance for the full breakdown.`;
  }
  return `«${title}»: your next milestone is «${next.label}» (about ₹${Math.round(next.targetAmount).toLocaleString('en-IN')}). Due dates and progress are on your Finance tab.`;
}

/** Short add-on for “terms saved” messages (no duplicate title). */
function buildPaymentScheduleShortLine(result) {
  const next = result.stages.find((s) => s.status !== 'PAID');
  if (!next) return 'All milestones show as satisfied from shared payments.';
  if (next.status === 'PARTIAL') {
    return `Current focus: «${next.label}» — ₹${Math.round(next.remaining).toLocaleString('en-IN')} left for this stage.`;
  }
  return `Next: «${next.label}» (~₹${Math.round(next.targetAmount).toLocaleString('en-IN')}).`;
}

/** Denormalize current_stage for SQL sorts / legacy readers. */
function deriveLegacyCurrentStageIndex(completed, active) {
  const n = LIFECYCLE_STAGES.length;
  if (active.length) return Math.min(Math.max(...active), n - 1);
  if (completed.length) return Math.min(Math.max(...completed), n - 1);
  return 0;
}

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'CLOSED_WON', 'CONVERTED', 'CLOSED_LOST'];
const PROJECT_STATUSES = ['ACTIVE', 'COMPLETED', 'ON_HOLD'];
const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

/** Total = Approved Quotation baseTotal + SUM(ExtraCosts WHERE status = 'APPROVED') */
function calculateProjectTotal(quotation, extraCosts) {
  const base = quotation && quotation.status === 'APPROVED' ? (Number(quotation.base_total) || 0) : 0;
  const extras = (Array.isArray(extraCosts) ? extraCosts : [])
    .filter((e) => e.status === 'APPROVED')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return base + extras;
}

/** Sum of client payments admin has approved for client visibility */
function sumApprovedClientPayments(payments) {
  return (Array.isArray(payments) ? payments : [])
    .filter((p) => Number(p.approved_for_client) === 1)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

/** Remaining amount client owes per published payments (never negative). */
function balanceDueAfterPublishedPayments(contractTotal, payments) {
  const paid = sumApprovedClientPayments(payments);
  const raw = (Number(contractTotal) || 0) - paid;
  return raw > 0 ? raw : 0;
}

/** Admin may mark completed only when published client payments cover the contract (no balance due, or overpaid). */
function canMarkProjectCompletedByBalance(contractTotal, payments) {
  const paid = sumApprovedClientPayments(payments);
  return (Number(contractTotal) || 0) - paid <= 0;
}

/** Group SITE_LOG media by year then month for vault UI */
function groupMediaByDate(mediaItems) {
  const byYear = {};
  (mediaItems || []).forEach((m) => {
    const d = m.created_at ? new Date(m.created_at) : new Date();
    const y = d.getFullYear();
    const monthKey = d.toLocaleString('default', { month: 'long' });
    if (!byYear[y]) byYear[y] = {};
    if (!byYear[y][monthKey]) byYear[y][monthKey] = [];
    byYear[y][monthKey].push(m);
  });
  return byYear;
}

/** Flat list of all vault media in gallery order (2D → 3D → Site log by date → Official) for prev/next navigation */
function buildVaultMediaList(media) {
  const list = [];
  const m = media || [];
  const catOrder = ['ARCHITECTURAL_PLANS', 'VISUALIZATIONS', 'SITE_LOG', 'OFFICIAL_DOCS'];
  const byCat = {};
  m.forEach((item) => {
    if (!byCat[item.category]) byCat[item.category] = [];
    byCat[item.category].push(item);
  });
  catOrder.forEach((cat) => {
    const items = (byCat[cat] || []).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    items.forEach((item) => list.push(item));
  });
  return list;
}

module.exports = {
  uuid,
  LIFECYCLE_STAGES,
  NUM_LIFECYCLE_STAGES,
  parseLifecycleStagesJson,
  enrichProjectLifecycle,
  lifecycleHeadline,
  deriveLegacyCurrentStageIndex,
  LEAD_STATUSES,
  PROJECT_STATUSES,
  APPROVAL_STATUSES,
  calculateProjectTotal,
  sumApprovedClientPayments,
  balanceDueAfterPublishedPayments,
  canMarkProjectCompletedByBalance,
  groupMediaByDate,
  buildVaultMediaList,
  DEFAULT_PAYMENT_TERMS_ITEMS,
  parsePaymentTermsJson,
  cloneDefaultPaymentTerms,
  sumPaymentTermsPercents,
  computePaymentMilestoneAllocations,
  fingerprintPaymentSchedule,
  buildPaymentScheduleNotifyMessage,
  buildPaymentScheduleShortLine,
};
