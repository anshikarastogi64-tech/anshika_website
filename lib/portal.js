/**
 * Portal constants and helpers (Luxury Interior CRM)
 * Specs: portal-master-v18, PORTAL_V18_FINAL_LIFECYCLE
 */

const crypto = require('crypto');

function uuid() {
  return crypto.randomBytes(16).toString('hex');
}

/** 11-stage interior lifecycle (v18) */
const LIFECYCLE_STAGES = [
  { index: 0, name: 'Onboarding', description: 'Briefing, contract signing, and portal setup.' },
  { index: 1, name: 'Site Survey', description: 'Measurement and structural analysis.' },
  { index: 2, name: 'Design Concept', description: 'Moodboards, color palettes, and theme finalization.' },
  { index: 3, name: '2D Space Planning', description: 'Detailed layouts and furniture placement.' },
  { index: 4, name: '3D Visualizations', description: 'High-fidelity photorealistic renders.' },
  { index: 5, name: 'Material Selection', description: 'Finalizing finishes, fabrics, and hardware.' },
  { index: 6, name: 'Procurement', description: 'Order placement for materials and decor.' },
  { index: 7, name: 'Civil & MEP Works', description: 'On-site masonry, electrical, and plumbing.' },
  { index: 8, name: 'Woodwork & Fit-outs', description: 'Carpentry and cabinetry installation.' },
  { index: 9, name: 'Finishing & Styling', description: 'Painting, lighting, and decor layering.' },
  { index: 10, name: 'Grand Handover', description: 'Quality audit and key handover.' },
];

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

module.exports = {
  uuid,
  LIFECYCLE_STAGES,
  LEAD_STATUSES,
  PROJECT_STATUSES,
  APPROVAL_STATUSES,
  calculateProjectTotal,
  groupMediaByDate,
};
