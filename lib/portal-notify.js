/**
 * Portal notification dispatch: respects admin-configured routing per category.
 * Designers never receive FINANCE category (hard rule — no financial alerts).
 * Clients also receive an email (when SMTP is configured) for each in-app alert.
 */

const { sendClientNotificationEmail } = require('./portal-email');

const CATEGORIES = {
  SYSTEM: 'SYSTEM',
  PROJECT: 'PROJECT',
  FINANCE: 'FINANCE',
  DESIGN: 'DESIGN',
  MEDIA: 'MEDIA',
  TIMELINE: 'TIMELINE',
  DAILY: 'DAILY',
  DOCUMENTS: 'DOCUMENTS',
  LEAD: 'LEAD',
  COMMENT: 'COMMENT',
};

/** Categories designers never receive, regardless of routing toggles */
const DESIGNER_HARD_DENY = new Set([CATEGORIES.FINANCE]);

const DEFAULT_ROUTING = {
  SYSTEM: { notify_client: 1, notify_admin: 1, notify_designer: 0 },
  PROJECT: { notify_client: 1, notify_admin: 1, notify_designer: 1 },
  FINANCE: { notify_client: 1, notify_admin: 1, notify_designer: 0 },
  DESIGN: { notify_client: 1, notify_admin: 1, notify_designer: 1 },
  MEDIA: { notify_client: 1, notify_admin: 1, notify_designer: 1 },
  TIMELINE: { notify_client: 1, notify_admin: 1, notify_designer: 1 },
  DAILY: { notify_client: 1, notify_admin: 1, notify_designer: 1 },
  DOCUMENTS: { notify_client: 1, notify_admin: 1, notify_designer: 1 },
  LEAD: { notify_client: 0, notify_admin: 1, notify_designer: 1 },
  COMMENT: { notify_client: 1, notify_admin: 1, notify_designer: 1 },
};

async function getRouting(db, category) {
  const row = await db.getNotificationRoutingRow(category);
  if (row) {
    return {
      notify_client: Number(row.notify_client) === 1,
      notify_admin: Number(row.notify_admin) === 1,
      notify_designer: Number(row.notify_designer) === 1,
    };
  }
  return DEFAULT_ROUTING[category] || { notify_client: 1, notify_admin: 1, notify_designer: 0 };
}

function shouldNotifyDesigner(category, routing) {
  if (!routing.notify_designer) return false;
  if (DESIGNER_HARD_DENY.has(category)) return false;
  return true;
}

/**
 * Notify client, designer, and/or admins for a project-scoped event.
 * @param {object} db portal-db module
 * @param {object} params
 */
async function notifyProjectStakeholders(db, params) {
  const {
    category,
    message,
    projectId,
    tabSuffix = '',
    excludeUserIds = [],
    /** When false, never notify the client (e.g. designer uploads pending admin approval). Routing toggle is ignored for client. */
    includeClient,
    /** When true, client still gets in-app notification but no generic notification email (e.g. payment thank-you is sent separately). */
    skipClientEmail = false,
  } = params;
  if (!category || !message || !projectId) return;
  const project = await db.getProjectById(projectId);
  if (!project) return;
  const routing = await getRouting(db, category);
  const ex = new Set((excludeUserIds || []).filter(Boolean));
  const clientEligible = includeClient !== false;

  const recipients = [];
  const suf = tabSuffix && tabSuffix.startsWith('#') ? tabSuffix : tabSuffix ? `#${tabSuffix}` : '';

  if (clientEligible && routing.notify_client && project.client_id && !ex.has(project.client_id)) {
    recipients.push({
      userId: project.client_id,
      linkUrl: `/portal/client/projects/${projectId}${suf}`,
    });
  }
  if (shouldNotifyDesigner(category, routing) && project.designer_id && !ex.has(project.designer_id)) {
    recipients.push({
      userId: project.designer_id,
      linkUrl: `/portal/designer/projects/${projectId}${suf}`,
    });
  }
  if (routing.notify_admin) {
    const admins = await db.getUsersByRole('ADMIN');
    for (const a of admins) {
      if (a.id && !ex.has(a.id)) {
        recipients.push({
          userId: a.id,
          linkUrl: `/portal/admin/projects/${projectId}${suf}`,
        });
      }
    }
  }

  for (const r of recipients) {
    await db.insertPortalNotification(r.userId, message, {
      category,
      linkUrl: r.linkUrl,
      projectId,
    });
    if (r.userId === project.client_id && !skipClientEmail) {
      const u = await db.getUserById(project.client_id);
      if (u && u.email) {
        await sendClientNotificationEmail({
          toEmail: u.email,
          recipientName: u.full_name,
          message,
          pathLink: r.linkUrl,
          projectTitle: project.title,
          category,
        });
      }
    }
  }
}

/**
 * Lead / CRM events (no project yet). Notifies admins and assigned designer.
 */
async function notifyLeadStakeholders(db, params) {
  const { category, message, leadId, excludeUserIds = [] } = params;
  if (!category || !message || !leadId) return;
  const lead = await db.getLeadById(leadId);
  if (!lead) return;
  const routing = await getRouting(db, category);
  const ex = new Set((excludeUserIds || []).filter(Boolean));

  if (routing.notify_admin) {
    const admins = await db.getUsersByRole('ADMIN');
    for (const a of admins) {
      if (a.id && !ex.has(a.id)) {
        await db.insertPortalNotification(a.id, message, {
          category,
          linkUrl: `/portal/admin/leads/${leadId}`,
          projectId: null,
        });
      }
    }
  }
  if (routing.notify_designer && shouldNotifyDesigner(category, routing) && lead.assigned_designer_id && !ex.has(lead.assigned_designer_id)) {
    await db.insertPortalNotification(lead.assigned_designer_id, message, {
      category,
      linkUrl: `/portal/designer/leads/${leadId}`,
      projectId: null,
    });
  }
}

/** Notify every admin (e.g. pending timeline extension). */
async function notifyAdmins(db, params) {
  const { category, message, linkUrl, projectId = null, excludeUserIds = [] } = params;
  if (!category || !message) return;
  const ex = new Set((excludeUserIds || []).filter(Boolean));
  const admins = await db.getUsersByRole('ADMIN');
  for (const a of admins) {
    if (a.id && !ex.has(a.id)) {
      await db.insertPortalNotification(a.id, message, {
        category,
        linkUrl: linkUrl || null,
        projectId,
      });
    }
  }
}

/** Fire-and-forget wrapper for route handlers */
function safeNotify(promise) {
  Promise.resolve(promise).catch(() => {});
}

module.exports = {
  CATEGORIES,
  notifyProjectStakeholders,
  notifyLeadStakeholders,
  notifyAdmins,
  getRouting,
  safeNotify,
};
