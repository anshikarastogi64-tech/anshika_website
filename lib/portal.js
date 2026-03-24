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
  groupMediaByDate,
  buildVaultMediaList,
};
