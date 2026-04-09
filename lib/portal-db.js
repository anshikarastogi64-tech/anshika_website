/**
 * Portal DB helpers (promisified SQLite)
 */
const { db } = require('../db');
const { uuid } = require('./portal');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

// ----- Users -----
async function createUser({ email, passwordHash, fullName, role = 'CLIENT', dvPointsBalance = 0 }) {
  const id = uuid();
  await run(
    'INSERT INTO portal_users (id, email, password_hash, full_name, role, dv_points_balance) VALUES (?, ?, ?, ?, ?, ?)',
    [id, email, passwordHash, fullName, role, dvPointsBalance]
  );
  return id;
}

async function getUserByEmail(email) {
  return get('SELECT * FROM portal_users WHERE email = ?', [email]);
}

async function getUserById(id) {
  return get('SELECT * FROM portal_users WHERE id = ?', [id]);
}

async function getUsersByRole(role) {
  return all('SELECT id, email, full_name, role, dv_points_balance, created_at FROM portal_users WHERE role = ? ORDER BY full_name', [role]);
}

async function updateDvPoints(userId, delta) {
  const u = await get('SELECT dv_points_balance FROM portal_users WHERE id = ?', [userId]);
  if (!u) return;
  const newBalance = (Number(u.dv_points_balance) || 0) + delta;
  await run('UPDATE portal_users SET dv_points_balance = ? WHERE id = ?', [newBalance, userId]);
}

// ----- Leads -----
async function createLead(data) {
  const id = uuid();
  await run(
    'INSERT INTO portal_leads (id, name, phone_number, email, status, notes, next_follow_up, referrer_id, assigned_designer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      data.name || '',
      data.phone_number || '',
      data.email || null,
      data.status || 'NEW',
      data.notes || null,
      data.next_follow_up || null,
      data.referrer_id || null,
      data.assigned_designer_id || null,
    ]
  );
  return id;
}

async function getLeadById(id) {
  return get('SELECT * FROM portal_leads WHERE id = ?', [id]);
}

async function getLeadByConvertedProjectId(projectId) {
  return get('SELECT * FROM portal_leads WHERE converted_project_id = ?', [projectId]);
}

async function getLeadsForAdmin() {
  return all(
    `SELECT l.*, u_referrer.full_name AS referrer_name, u_designer.full_name AS designer_name
     FROM portal_leads l
     LEFT JOIN portal_users u_referrer ON l.referrer_id = u_referrer.id
     LEFT JOIN portal_users u_designer ON l.assigned_designer_id = u_designer.id
     ORDER BY l.updated_at DESC`
  );
}

async function getLeadsByReferrerId(referrerId) {
  return all(
    'SELECT * FROM portal_leads WHERE referrer_id = ? ORDER BY created_at DESC',
    [referrerId]
  );
}

async function getLeadsForDesigner(designerId) {
  return all(
    `SELECT l.*, u_referrer.full_name AS referrer_name
     FROM portal_leads l
     LEFT JOIN portal_users u_referrer ON l.referrer_id = u_referrer.id
     WHERE l.assigned_designer_id = ? OR l.assigned_designer_id IS NULL
     ORDER BY l.updated_at DESC`,
    [designerId]
  );
}

async function updateLead(id, updates) {
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.phone_number !== undefined) { fields.push('phone_number = ?'); values.push(updates.phone_number); }
  if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
  if (updates.next_follow_up !== undefined) { fields.push('next_follow_up = ?'); values.push(updates.next_follow_up); }
  if (updates.assigned_designer_id !== undefined) { fields.push('assigned_designer_id = ?'); values.push(updates.assigned_designer_id); }
  if (updates.converted_project_id !== undefined) { fields.push('converted_project_id = ?'); values.push(updates.converted_project_id); }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  await run(`UPDATE portal_leads SET ${fields.join(', ')} WHERE id = ?`, values);
}

// ----- Lead Activities (timeline) -----
async function addLeadActivity(leadId, note) {
  const id = uuid();
  await run('INSERT INTO lead_activities (id, lead_id, note) VALUES (?, ?, ?)', [id, leadId, note]);
  return id;
}

async function getLeadActivities(leadId) {
  return all('SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC', [leadId]);
}

// ----- Projects -----
async function createProject(data) {
  const id = uuid();
  await run(
    'INSERT INTO portal_projects (id, title, budget, current_stage, status, rtsp_link, client_id, designer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      data.title || 'New Project',
      data.budget || 0,
      data.current_stage ?? 0,
      data.status || 'ACTIVE',
      data.rtsp_link || null,
      data.client_id,
      data.designer_id,
    ]
  );
  await ensureProjectMemberRow(id, data.client_id, null);
  if (data.designer_id) await ensureProjectDesignerRow(id, data.designer_id, null);
  return id;
}

async function getProjectById(id) {
  return get('SELECT * FROM portal_projects WHERE id = ?', [id]);
}

async function getProjectWithRelations(id) {
  const project = await get(
    `SELECT p.*, c.full_name AS client_name, c.email AS client_email, d.full_name AS designer_name
     FROM portal_projects p
     JOIN portal_users c ON p.client_id = c.id
     JOIN portal_users d ON p.designer_id = d.id
     WHERE p.id = ?`,
    [id]
  );
  return project;
}

async function getProjectsForAdmin() {
  return all(
    `SELECT p.*, c.full_name AS client_name, d.full_name AS designer_name
     FROM portal_projects p
     JOIN portal_users c ON p.client_id = c.id
     JOIN portal_users d ON p.designer_id = d.id
     ORDER BY p.created_at DESC`
  );
}

async function getProjectsForDesigner(designerId) {
  return all(
    `SELECT * FROM (
       SELECT p.*, c.full_name AS client_name
       FROM portal_projects p
       JOIN portal_users c ON p.client_id = c.id
       WHERE p.designer_id = ?
       UNION
       SELECT p.*, c.full_name AS client_name
       FROM portal_projects p
       JOIN portal_users c ON p.client_id = c.id
       INNER JOIN portal_project_designers pd ON pd.project_id = p.id AND pd.user_id = ?
     ) ORDER BY created_at DESC`,
    [designerId, designerId]
  );
}

/** Keys for client project tabs (admin can enable/disable per member). */
const CLIENT_PORTAL_TAB_KEYS = [
  'updates',
  'timelines',
  'mood-board',
  'vault',
  'material-selection',
  'daily',
  'finance',
  'warranty',
  'vastu',
  'other-docs',
];

function defaultClientTabsJson() {
  return JSON.stringify(CLIENT_PORTAL_TAB_KEYS);
}

function parseAllowedTabsJson(json) {
  try {
    const a = JSON.parse(json || '[]');
    if (!Array.isArray(a)) return [...CLIENT_PORTAL_TAB_KEYS];
    const valid = new Set(CLIENT_PORTAL_TAB_KEYS);
    const filtered = a.filter((k) => valid.has(k));
    return filtered.length ? filtered : [...CLIENT_PORTAL_TAB_KEYS];
  } catch {
    return [...CLIENT_PORTAL_TAB_KEYS];
  }
}

/** Designer project tabs (admin can enable/disable per designer on a project). */
const DESIGNER_PORTAL_TAB_KEYS = [
  'updates',
  'timelines',
  'mood-board',
  'vault',
  'material-selection',
  'daily',
  'vastu',
  'other-docs',
];

function defaultDesignerTabsJson() {
  return JSON.stringify(DESIGNER_PORTAL_TAB_KEYS);
}

function parseDesignerTabsJson(json) {
  try {
    const a = JSON.parse(json || '[]');
    if (!Array.isArray(a)) return [...DESIGNER_PORTAL_TAB_KEYS];
    const valid = new Set(DESIGNER_PORTAL_TAB_KEYS);
    const filtered = a.filter((k) => valid.has(k));
    return filtered.length ? filtered : [...DESIGNER_PORTAL_TAB_KEYS];
  } catch {
    return [...DESIGNER_PORTAL_TAB_KEYS];
  }
}

async function designerHasProjectAccess(userId, projectId) {
  const project = await getProjectById(projectId);
  if (!project) return false;
  if (project.designer_id === userId) return true;
  const row = await get('SELECT 1 AS ok FROM portal_project_designers WHERE project_id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);
  return !!row;
}

async function getDesignerProjectPortalAccess(userId, projectId) {
  const project = await getProjectById(projectId);
  if (!project) return null;
  const row = await get('SELECT allowed_tabs FROM portal_project_designers WHERE project_id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);
  if (row) {
    return { project, allowedTabs: new Set(parseDesignerTabsJson(row.allowed_tabs)) };
  }
  if (project.designer_id === userId) {
    return { project, allowedTabs: new Set(DESIGNER_PORTAL_TAB_KEYS) };
  }
  return null;
}

async function ensureProjectDesignerRow(projectId, userId, allowedTabsJson) {
  const json = allowedTabsJson || defaultDesignerTabsJson();
  const existing = await get('SELECT 1 AS ok FROM portal_project_designers WHERE project_id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);
  if (existing) return;
  await run('INSERT INTO portal_project_designers (id, project_id, user_id, allowed_tabs) VALUES (?, ?, ?, ?)', [
    uuid(),
    projectId,
    userId,
    json,
  ]);
}

async function setProjectPrimaryDesignerAndSyncJunction(projectId, newDesignerId) {
  if (!newDesignerId) return;
  const project = await getProjectById(projectId);
  if (!project) return;
  const oldId = project.designer_id;
  await updateProject(projectId, { designer_id: newDesignerId });
  await ensureProjectDesignerRow(projectId, newDesignerId, null);
  if (oldId && oldId !== newDesignerId) {
    await run('DELETE FROM portal_project_designers WHERE project_id = ? AND user_id = ?', [projectId, oldId]);
  }
}

async function getProjectDesignersWithUsers(projectId) {
  return all(
    `SELECT pd.id AS designer_row_id, pd.user_id, pd.allowed_tabs, u.email, u.full_name,
            CASE WHEN p.designer_id = pd.user_id THEN 1 ELSE 0 END AS is_primary_designer
     FROM portal_project_designers pd
     JOIN portal_users u ON u.id = pd.user_id
     JOIN portal_projects p ON p.id = pd.project_id
     WHERE pd.project_id = ?
     ORDER BY is_primary_designer DESC, u.full_name`,
    [projectId]
  );
}

async function addProjectDesigner(projectId, userId) {
  const u = await getUserById(userId);
  if (!u || u.role !== 'DESIGNER') {
    const err = new Error('Only DESIGNER users can be added to a project.');
    err.code = 'INVALID_DESIGNER_ROLE';
    throw err;
  }
  const existing = await get('SELECT 1 AS ok FROM portal_project_designers WHERE project_id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);
  if (existing) {
    const err = new Error('This designer is already on the project.');
    err.code = 'DUPLICATE_DESIGNER';
    throw err;
  }
  await ensureProjectDesignerRow(projectId, userId, null);
}

async function removeProjectDesigner(projectId, userId) {
  const project = await getProjectById(projectId);
  if (!project) return { ok: false, reason: 'not_found' };
  if (project.designer_id === userId) {
    return { ok: false, reason: 'primary_designer' };
  }
  await run('DELETE FROM portal_project_designers WHERE project_id = ? AND user_id = ?', [projectId, userId]);
  return { ok: true };
}

async function updateProjectDesignerTabs(projectId, userId, tabsArray) {
  await ensureProjectDesignerRow(projectId, userId, null);
  const valid = new Set(DESIGNER_PORTAL_TAB_KEYS);
  const next = (tabsArray || []).filter((k) => valid.has(k));
  const json = JSON.stringify(next.length ? next : ['updates']);
  await run('UPDATE portal_project_designers SET allowed_tabs = ? WHERE project_id = ? AND user_id = ?', [
    json,
    projectId,
    userId,
  ]);
}

async function getProjectDesignerRecipientUserIds(projectId) {
  const project = await getProjectById(projectId);
  if (!project) return [];
  const rows = await all('SELECT DISTINCT user_id FROM portal_project_designers WHERE project_id = ?', [projectId]);
  const ids = new Set((rows || []).map((r) => r.user_id).filter(Boolean));
  if (project.designer_id) ids.add(project.designer_id);
  return [...ids];
}

async function ensureProjectMemberRow(projectId, userId, allowedTabsJson) {
  const json = allowedTabsJson || defaultClientTabsJson();
  const existing = await get('SELECT 1 AS ok FROM portal_project_members WHERE project_id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);
  if (existing) return;
  await run('INSERT INTO portal_project_members (id, project_id, user_id, allowed_tabs) VALUES (?, ?, ?, ?)', [
    uuid(),
    projectId,
    userId,
    json,
  ]);
}

async function getProjectMembersWithUsers(projectId) {
  return all(
    `SELECT m.id AS member_row_id, m.user_id, m.allowed_tabs, u.email, u.full_name, u.role,
            CASE WHEN p.client_id = m.user_id THEN 1 ELSE 0 END AS is_primary_client
     FROM portal_project_members m
     JOIN portal_users u ON u.id = m.user_id
     JOIN portal_projects p ON p.id = m.project_id
     WHERE m.project_id = ?
     ORDER BY is_primary_client DESC, u.full_name`,
    [projectId]
  );
}

async function getClientProjectPortalAccess(userId, projectId) {
  const project = await getProjectById(projectId);
  if (!project) return null;
  const row = await get('SELECT allowed_tabs FROM portal_project_members WHERE project_id = ? AND user_id = ?', [
    projectId,
    userId,
  ]);
  if (row) {
    return { project, allowedTabs: new Set(parseAllowedTabsJson(row.allowed_tabs)) };
  }
  if (project.client_id === userId) {
    return { project, allowedTabs: new Set(CLIENT_PORTAL_TAB_KEYS) };
  }
  return null;
}

async function getProjectsForClient(clientId) {
  return all(
    `SELECT * FROM (
       SELECT p.* FROM portal_projects p WHERE p.client_id = ?
       UNION
       SELECT p.* FROM portal_projects p
       INNER JOIN portal_project_members m ON m.project_id = p.id AND m.user_id = ?
     ) ORDER BY created_at DESC`,
    [clientId, clientId]
  );
}

async function updateProjectMemberTabs(projectId, userId, tabsArray) {
  const valid = new Set(CLIENT_PORTAL_TAB_KEYS);
  const next = (tabsArray || []).filter((k) => valid.has(k));
  const json = JSON.stringify(next.length ? next : ['updates']);
  await run('UPDATE portal_project_members SET allowed_tabs = ? WHERE project_id = ? AND user_id = ?', [
    json,
    projectId,
    userId,
  ]);
}

async function addProjectMember(projectId, userId) {
  const u = await getUserById(userId);
  if (!u || u.role !== 'CLIENT') {
    const err = new Error('Only CLIENT users can be added to a project portal.');
    err.code = 'INVALID_MEMBER_ROLE';
    throw err;
  }
  await ensureProjectMemberRow(projectId, userId, null);
}

async function removeProjectMember(projectId, userId) {
  const project = await getProjectById(projectId);
  if (!project) return { ok: false, reason: 'not_found' };
  if (project.client_id === userId) {
    return { ok: false, reason: 'primary_client' };
  }
  await run('DELETE FROM portal_project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);
  return { ok: true };
}

/** All portal user ids with CLIENT role linked to this project (notifications). */
async function getProjectClientRecipientUserIds(projectId) {
  const project = await getProjectById(projectId);
  if (!project) return [];
  const rows = await all('SELECT DISTINCT user_id FROM portal_project_members WHERE project_id = ?', [projectId]);
  const ids = new Set((rows || []).map((r) => r.user_id).filter(Boolean));
  if (project.client_id) ids.add(project.client_id);
  const out = [];
  for (const id of ids) {
    const u = await getUserById(id);
    if (u && u.role === 'CLIENT') out.push(id);
  }
  return out;
}

async function canAccessProjectCctv(userId, role, projectId) {
  const project = await getProjectById(projectId);
  if (!project) return false;
  if (role === 'ADMIN') return true;
  if (role === 'DESIGNER' && (await designerHasProjectAccess(userId, projectId))) return true;
  if (role === 'CLIENT') {
    const acc = await getClientProjectPortalAccess(userId, projectId);
    return !!(acc && acc.allowedTabs.has('updates'));
  }
  return false;
}

async function updateProject(id, updates) {
  const allowed = [
    'title',
    'budget',
    'current_stage',
    'status',
    'rtsp_link',
    'personality_pdf_url',
    'final_total_cost',
    'dv_points_processed',
    'invoice_locked',
    'designer_id',
    'designer_can_see_finance',
    'designer_can_view_mirror',
    'design_timeline_start',
    'design_timeline_end',
    'design_timeline_duration_days',
    'design_timeline_visible_to_client',
    'execution_timeline_start',
    'execution_timeline_end',
    'execution_timeline_duration_days',
    'execution_timeline_visible_to_client',
    'design_timeline_completed_date',
    'execution_timeline_completed_date',
    'lifecycle_completed_stages',
    'lifecycle_active_stages',
    'payment_terms_json',
    'payment_schedule_notify_fingerprint',
  ];
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(updates)) {
    if (allowed.includes(k) && v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await run(`UPDATE portal_projects SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function getTimelineExtensions(projectId) {
  return all(
    `SELECT e.*,
            u.full_name AS requester_name,
            r.full_name AS reviewer_name
     FROM portal_timeline_extensions e
     LEFT JOIN portal_users u ON e.requested_by_user_id = u.id
     LEFT JOIN portal_users r ON e.reviewed_by_user_id = r.id
     WHERE e.project_id = ?
     ORDER BY e.created_at DESC`,
    [projectId]
  );
}

async function getTimelineExtensionById(id) {
  return get('SELECT * FROM portal_timeline_extensions WHERE id = ?', [id]);
}

async function createTimelineExtension(projectId, phase, extraDays, reason, userId, role) {
  const id = uuid();
  await run(
    `INSERT INTO portal_timeline_extensions (id, project_id, phase, extra_days, reason, requested_by_user_id, requested_by_role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [id, projectId, phase, extraDays, reason, userId || null, role]
  );
  return id;
}

async function approveTimelineExtension(extensionId, reviewerUserId) {
  const ext = await getTimelineExtensionById(extensionId);
  if (!ext || ext.status !== 'PENDING') return false;
  if (ext.phase !== 'DESIGN' && ext.phase !== 'EXECUTION') return false;
  await run(
    `UPDATE portal_timeline_extensions SET status = 'APPROVED', reviewed_by_user_id = ?, reviewed_at = ? WHERE id = ?`,
    [reviewerUserId, new Date().toISOString(), extensionId]
  );
  return true;
}

async function rejectTimelineExtension(extensionId, reviewerUserId, reviewNote) {
  const ext = await getTimelineExtensionById(extensionId);
  if (!ext || ext.status !== 'PENDING') return false;
  await run(
    `UPDATE portal_timeline_extensions SET status = 'REJECTED', reviewed_by_user_id = ?, reviewed_at = ?, review_note = ? WHERE id = ?`,
    [reviewerUserId, new Date().toISOString(), reviewNote || null, extensionId]
  );
  return true;
}

// ----- Client payments (recorded by admin; client sees only approved rows) -----
async function getClientPaymentsByProject(projectId) {
  return all(
    'SELECT * FROM portal_client_payments WHERE project_id = ? ORDER BY received_date DESC, created_at DESC',
    [projectId]
  );
}

async function getClientPaymentById(id) {
  return get('SELECT * FROM portal_client_payments WHERE id = ?', [id]);
}

async function addClientPayment(projectId, amount, receivedDate, note) {
  const id = uuid();
  await run(
    'INSERT INTO portal_client_payments (id, project_id, amount, received_date, note, approved_for_client) VALUES (?, ?, ?, ?, ?, 0)',
    [id, projectId, amount, receivedDate, note || null]
  );
  return id;
}

async function setClientPaymentApprovedForClient(paymentId, projectId, approved) {
  const row = await get('SELECT id FROM portal_client_payments WHERE id = ? AND project_id = ?', [paymentId, projectId]);
  if (!row) return false;
  await run('UPDATE portal_client_payments SET approved_for_client = ? WHERE id = ?', [approved ? 1 : 0, paymentId]);
  return true;
}

async function deleteClientPayment(paymentId, projectId) {
  const row = await get('SELECT id FROM portal_client_payments WHERE id = ? AND project_id = ?', [paymentId, projectId]);
  if (!row) return false;
  await run('DELETE FROM portal_client_payments WHERE id = ?', [paymentId]);
  return true;
}

// ----- Quotations -----
async function getQuotationById(id) {
  return get('SELECT * FROM portal_quotations WHERE id = ?', [id]);
}

async function getLatestQuotationByProjectId(projectId) {
  return get('SELECT * FROM portal_quotations WHERE project_id = ? ORDER BY created_at DESC LIMIT 1', [projectId]);
}

async function createQuotation(projectId, baseTotal, items = []) {
  const id = uuid();
  await run(
    'INSERT INTO portal_quotations (id, project_id, base_total, items, status) VALUES (?, ?, ?, ?, ?)',
    [id, projectId, baseTotal, JSON.stringify(items || []), 'PENDING']
  );
  return id;
}

async function updateQuotation(id, updates) {
  const allowed = ['base_total', 'items', 'status', 'client_comments', 'approved_at', 'is_final', 'pdf_url'];
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(updates)) {
    if (allowed.includes(k) && v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (updates.approved_at === undefined && updates.status === 'APPROVED') {
    fields.push('approved_at = ?');
    values.push(new Date().toISOString());
  }
  if (fields.length === 0) return;
  values.push(id);
  await run(`UPDATE portal_quotations SET ${fields.join(', ')} WHERE id = ?`, values);
}

// ----- Extra Costs -----
async function getExtraCostById(id) {
  return get('SELECT * FROM portal_extra_costs WHERE id = ?', [id]);
}

async function getExtraCostsByQuotationId(quotationId) {
  return all('SELECT * FROM portal_extra_costs WHERE quotation_id = ? ORDER BY created_at ASC', [quotationId]);
}

async function createExtraCost(quotationId, description, amount, comment, replacesId = null) {
  const id = uuid();
  await run(
    'INSERT INTO portal_extra_costs (id, quotation_id, description, amount, status, comment, replaces_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, quotationId, description, amount, 'PENDING', comment || null, replacesId || null]
  );
  return id;
}

async function updateExtraCost(id, updates) {
  const allowed = ['status', 'client_note', 'response_note', 'approved_at'];
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(updates)) {
    if (allowed.includes(k) && v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (updates.approved_at === undefined && updates.status === 'APPROVED') {
    fields.push('approved_at = ?');
    values.push(new Date().toISOString());
  }
  if (fields.length === 0) return;
  values.push(id);
  await run(`UPDATE portal_extra_costs SET ${fields.join(', ')} WHERE id = ?`, values);
}

// ----- Extra cost comments (append-only; no update/delete) -----
async function addExtraCostComment(extraCostId, authorType, userId, message) {
  const id = uuid();
  await run(
    'INSERT INTO portal_extra_cost_comments (id, extra_cost_id, author_type, user_id, message) VALUES (?, ?, ?, ?, ?)',
    [id, extraCostId, authorType, userId || null, (message || '').trim() || null]
  );
  return id;
}

async function getCommentsByExtraCostId(extraCostId) {
  return all('SELECT * FROM portal_extra_cost_comments WHERE extra_cost_id = ? ORDER BY created_at ASC', [extraCostId]);
}

async function getCommentsByExtraCostIds(extraCostIds) {
  if (!extraCostIds || extraCostIds.length === 0) return [];
  const placeholders = extraCostIds.map(() => '?').join(',');
  return all(
    'SELECT * FROM portal_extra_cost_comments WHERE extra_cost_id IN (' + placeholders + ') ORDER BY created_at ASC',
    extraCostIds
  );
}

// ----- Media (Vault) -----
async function getProjectMedia(projectId, category = null) {
  if (category) {
    return all('SELECT * FROM portal_media WHERE project_id = ? AND category = ? ORDER BY created_at ASC', [projectId, category]);
  }
  return all('SELECT * FROM portal_media WHERE project_id = ? ORDER BY category, created_at ASC', [projectId]);
}

async function addProjectMedia(projectId, url, type, category, fileName = null, fileSize = null, seventhArg = null) {
  let vastuCategoryName = null;
  let mediaOpts = {};
  if (seventhArg != null && typeof seventhArg === 'object' && !Array.isArray(seventhArg)) {
    mediaOpts = seventhArg;
    vastuCategoryName =
      mediaOpts.vastuCategoryName != null ? String(mediaOpts.vastuCategoryName).trim() || null : null;
  } else if (typeof seventhArg === 'string') {
    vastuCategoryName = seventhArg.trim() || null;
  }

  const uploadedByRole = mediaOpts.uploadedByRole != null ? String(mediaOpts.uploadedByRole).toUpperCase() : null;

  let approved = 1;
  if (category === 'WARRANTY_GUARANTEE' || category === 'VASTU' || category === 'OTHER_DOCS') {
    approved = 0;
  } else if (category === 'SITE_LOG' || category === 'OFFICIAL_DOCS') {
    approved = uploadedByRole === 'DESIGNER' ? 0 : 1;
  } else {
    approved = 1;
  }

  let visibleToDesigner = 1;

  if (category === 'OTHER_DOCS') {
    if (uploadedByRole === 'DESIGNER') {
      visibleToDesigner =
        mediaOpts.visibleToDesigner !== undefined && mediaOpts.visibleToDesigner !== null
          ? mediaOpts.visibleToDesigner
            ? 1
            : 0
          : 1;
    } else if (uploadedByRole === 'ADMIN') {
      visibleToDesigner =
        mediaOpts.visibleToDesigner !== undefined && mediaOpts.visibleToDesigner !== null
          ? mediaOpts.visibleToDesigner
            ? 1
            : 0
          : 0;
    } else {
      visibleToDesigner = mediaOpts.visibleToDesigner ? 1 : 0;
      uploadedByRole = uploadedByRole || null;
    }
  }

  const id = uuid();
  await run(
    'INSERT INTO portal_media (id, project_id, url, type, category, file_name, file_size, approved, vastu_category_name, uploaded_by_role, visible_to_designer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, url, type, category, fileName, fileSize, approved, vastuCategoryName, uploadedByRole, visibleToDesigner]
  );
  return id;
}

async function approveSiteLogOrOfficialForClient(projectId, mediaId) {
  const row = await get(
    "SELECT id FROM portal_media WHERE id = ? AND project_id = ? AND category IN ('SITE_LOG','OFFICIAL_DOCS')",
    [mediaId, projectId]
  );
  if (!row) return false;
  await run('UPDATE portal_media SET approved = 1 WHERE id = ? AND project_id = ?', [mediaId, projectId]);
  return true;
}

async function updateOtherDocMedia(projectId, mediaId, fields) {
  const row = await get(
    'SELECT id FROM portal_media WHERE id = ? AND project_id = ? AND category = ?',
    [mediaId, projectId, 'OTHER_DOCS']
  );
  if (!row) return false;
  const updates = [];
  const vals = [];
  if (fields.approved !== undefined) {
    updates.push('approved = ?');
    vals.push(fields.approved ? 1 : 0);
  }
  if (fields.visible_to_designer !== undefined) {
    updates.push('visible_to_designer = ?');
    vals.push(fields.visible_to_designer ? 1 : 0);
  }
  if (!updates.length) return true;
  vals.push(mediaId, projectId);
  await run(`UPDATE portal_media SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`, vals);
  return true;
}

async function deleteProjectMedia(projectId, mediaId) {
  const row = await get('SELECT id FROM portal_media WHERE id = ? AND project_id = ?', [mediaId, projectId]);
  if (!row) return false;
  const usedByDesign = await get('SELECT id FROM portal_design_versions WHERE media_id = ?', [mediaId]);
  if (usedByDesign) return false;
  await run('DELETE FROM portal_media WHERE id = ? AND project_id = ?', [mediaId, projectId]);
  return true;
}

// ----- 2D/3D Designs (review, versioning, links) -----
const DESIGN_ADMIN_STATUS = { PENDING_ADMIN: 'PENDING_ADMIN', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };
const DESIGN_CLIENT_STATUS = { PENDING: 'PENDING', APPROVED: 'APPROVED', DENIED: 'DENIED' };

async function createDesign(projectId, category, areaTag = '') {
  const id = uuid();
  await run(
    'INSERT INTO portal_designs (id, project_id, category, area_tag) VALUES (?, ?, ?, ?)',
    [id, projectId, category, (areaTag || '').trim()]
  );
  return id;
}

async function getDesignById(id) {
  return get('SELECT * FROM portal_designs WHERE id = ?', [id]);
}

async function getDesignsByProject(projectId) {
  return all('SELECT * FROM portal_designs WHERE project_id = ? ORDER BY category, area_tag, created_at', [projectId]);
}

// ----- Material selection (laminates / materials — client approves) -----
async function getMaterialSelectionsForProject(projectId) {
  return all(
    `SELECT m.*,
            d.area_tag AS linked_design_area_tag,
            d.category AS linked_design_category,
            v.version_number AS linked_version_number
     FROM portal_material_selections m
     LEFT JOIN portal_design_versions v ON v.id = m.linked_design_version_id
     LEFT JOIN portal_designs d ON d.id = COALESCE(v.design_id, m.linked_design_id)
     WHERE m.project_id = ?
     ORDER BY m.area_tag COLLATE NOCASE, m.created_at DESC`,
    [projectId]
  );
}

async function getMaterialSelectionById(id) {
  return get('SELECT * FROM portal_material_selections WHERE id = ?', [id]);
}

async function createMaterialSelection({
  projectId,
  areaTag,
  linkedDesignVersionId,
  materialCode,
  imageUrl,
  fileName,
  uploadedByUserId,
  uploadedByRole,
}) {
  let linkVersionId =
    linkedDesignVersionId && String(linkedDesignVersionId).trim() ? String(linkedDesignVersionId).trim() : null;
  let linkDesignId = null;
  if (linkVersionId) {
    const v = await getDesignVersionById(linkVersionId);
    if (!v || v.admin_status !== 'APPROVED') {
      linkVersionId = null;
    } else {
      const d = await getDesignById(v.design_id);
      if (!d || d.project_id !== projectId) {
        linkVersionId = null;
      } else {
        linkDesignId = d.id;
      }
    }
  }
  const id = uuid();
  await run(
    `INSERT INTO portal_material_selections (
       id, project_id, area_tag, linked_design_id, linked_design_version_id, material_code, image_url, file_name,
       client_status, uploaded_by_user_id, uploaded_by_role
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
    [
      id,
      projectId,
      (areaTag || '').trim() || 'General',
      linkDesignId,
      linkVersionId,
      (materialCode || '').trim(),
      imageUrl,
      fileName || null,
      uploadedByUserId || null,
      uploadedByRole === 'DESIGNER' ? 'DESIGNER' : 'ADMIN',
    ]
  );
  return id;
}

async function deleteMaterialSelection(projectId, materialId) {
  const row = await get('SELECT image_url FROM portal_material_selections WHERE id = ? AND project_id = ?', [
    materialId,
    projectId,
  ]);
  if (!row) return { ok: false };
  await run('DELETE FROM portal_material_selections WHERE id = ? AND project_id = ?', [materialId, projectId]);
  return { ok: true, image_url: row.image_url };
}

async function setMaterialSelectionClientStatus(projectId, materialId, status, clientNote) {
  const allowed = new Set(['PENDING', 'APPROVED', 'REJECTED']);
  if (!allowed.has(status)) return false;
  const r = await run(
    'UPDATE portal_material_selections SET client_status = ?, client_note = ? WHERE id = ? AND project_id = ?',
    [status, clientNote != null ? String(clientNote).trim() || null : null, materialId, projectId]
  );
  return r.changes > 0;
}

async function getDesignVersions(designId) {
  return all(
    `SELECT v.*, m.url, m.type AS media_type, m.file_name, m.category AS media_category
     FROM portal_design_versions v
     JOIN portal_media m ON m.id = v.media_id
     WHERE v.design_id = ?
     ORDER BY v.version_number ASC`,
    [designId]
  );
}

async function getDesignVersionById(id) {
  return get(
    `SELECT v.*, m.url, m.type AS media_type, m.file_name, m.category AS media_category
     FROM portal_design_versions v
     JOIN portal_media m ON m.id = v.media_id
     WHERE v.id = ?`,
    [id]
  );
}

async function getNextVersionNumber(designId) {
  const row = await get('SELECT MAX(version_number) AS n FROM portal_design_versions WHERE design_id = ?', [designId]);
  return (row && row.n != null ? row.n : 0) + 1;
}

async function createDesignVersion(designId, mediaId, createdBy, adminStatus = 'PENDING_ADMIN', clientStatus = 'PENDING') {
  const versionNumber = await getNextVersionNumber(designId);
  const id = uuid();
  await run(
    'INSERT INTO portal_design_versions (id, design_id, media_id, version_number, admin_status, client_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, designId, mediaId, versionNumber, adminStatus, clientStatus, createdBy]
  );
  return id;
}

async function updateDesignVersion(id, updates) {
  const fields = [];
  const values = [];
  if (updates.admin_status !== undefined) { fields.push('admin_status = ?'); values.push(updates.admin_status); }
  if (updates.client_status !== undefined) { fields.push('client_status = ?'); values.push(updates.client_status); }
  if (fields.length === 0) return;
  values.push(id);
  await run('UPDATE portal_design_versions SET ' + fields.join(', ') + ' WHERE id = ?', values);
}

async function getDesignLinksForProject(projectId) {
  return all(
    'SELECT * FROM portal_design_links WHERE project_id = ? ORDER BY created_at',
    [projectId]
  );
}

async function getLinkedDesignIds(designId) {
  const design = await getDesignById(designId);
  if (!design) return { linked2d: [], linked3d: [] };
  const links = await all(
    'SELECT design_id_2d, design_id_3d FROM portal_design_links WHERE project_id = (SELECT project_id FROM portal_designs WHERE id = ?)',
    [designId]
  );
  const linked2d = [];
  const linked3d = [];
  const cat2d = 'ARCHITECTURAL_PLANS';
  links.forEach((l) => {
    if (l.design_id_2d === designId) linked3d.push(l.design_id_3d);
    else if (l.design_id_3d === designId) linked2d.push(l.design_id_2d);
  });
  return { linked2d, linked3d };
}

async function addDesignLink(projectId, designId2d, designId3d) {
  if (!designId2d || !designId3d || designId2d === designId3d) return null;
  const id = uuid();
  await run(
    'INSERT INTO portal_design_links (id, project_id, design_id_2d, design_id_3d) VALUES (?, ?, ?, ?)',
    [id, projectId, designId2d, designId3d]
  );
  return id;
}

async function removeDesignLink(id) {
  await run('DELETE FROM portal_design_links WHERE id = ?', [id]);
}

async function getDesignCommentsByVersionIds(versionIds) {
  if (!versionIds || versionIds.length === 0) return {};
  const placeholders = versionIds.map(() => '?').join(',');
  const rows = await all(
    'SELECT * FROM portal_design_comments WHERE design_version_id IN (' + placeholders + ') ORDER BY created_at ASC',
    versionIds
  );
  const byVersion = {};
  versionIds.forEach((vid) => { byVersion[vid] = []; });
  rows.forEach((r) => {
    if (!byVersion[r.design_version_id]) byVersion[r.design_version_id] = [];
    byVersion[r.design_version_id].push(r);
  });
  return byVersion;
}

async function addDesignComment(designVersionId, authorType, userId, message) {
  const id = uuid();
  await run(
    'INSERT INTO portal_design_comments (id, design_version_id, author_type, user_id, message) VALUES (?, ?, ?, ?, ?)',
    [id, designVersionId, authorType, userId, message]
  );
  return id;
}

/** Designs with versions and media. forClient: only admin-approved versions; forAdmin/designer: all. */
async function getDesignsForProjectWithDetails(projectId, { forClient = false } = {}) {
  const designs = await getDesignsByProject(projectId);
  const links = await getDesignLinksForProject(projectId);
  const linkMap2dTo3d = {};
  const linkMap3dTo2d = {};
  links.forEach((l) => {
    if (!linkMap2dTo3d[l.design_id_2d]) linkMap2dTo3d[l.design_id_2d] = [];
    linkMap2dTo3d[l.design_id_2d].push(l.design_id_3d);
    if (!linkMap3dTo2d[l.design_id_3d]) linkMap3dTo2d[l.design_id_3d] = [];
    linkMap3dTo2d[l.design_id_3d].push(l.design_id_2d);
  });
  const result = [];
  for (const d of designs) {
    const versions = await getDesignVersions(d.id);
    let versionsToShow = versions;
    if (forClient) {
      versionsToShow = versions.filter((v) => v.admin_status === 'APPROVED');
      if (versionsToShow.length === 0) continue;
    }
    const versionIds = versionsToShow.map((v) => v.id);
    const commentsByVersion = await getDesignCommentsByVersionIds(versionIds);
    versionsToShow.forEach((v) => { v.comments = commentsByVersion[v.id] || []; });
    const linked2d = linkMap3dTo2d[d.id] || [];
    const linked3d = linkMap2dTo3d[d.id] || [];
    result.push({
      ...d,
      versions: versionsToShow,
      linked2d,
      linked3d,
    });
  }
  return result;
}

async function getPendingDesignVersionsForProject(projectId) {
  return all(
    `SELECT v.*, m.url, m.file_name, m.type AS media_type, d.category AS design_category, d.area_tag
     FROM portal_design_versions v
     JOIN portal_media m ON m.id = v.media_id
     JOIN portal_designs d ON d.id = v.design_id
     WHERE d.project_id = ? AND v.admin_status = 'PENDING_ADMIN'
     ORDER BY v.created_at DESC`,
    [projectId]
  );
}

async function deleteDesign(designId) {
  const versions = await all('SELECT id, media_id FROM portal_design_versions WHERE design_id = ?', [designId]);
  await run('DELETE FROM portal_design_comments WHERE design_version_id IN (SELECT id FROM portal_design_versions WHERE design_id = ?)', [designId]);
  await run('DELETE FROM portal_design_versions WHERE design_id = ?', [designId]);
  for (const v of versions) {
    await run('DELETE FROM portal_media WHERE id = ?', [v.media_id]);
  }
  await clearDesignLinks(designId);
  await run('DELETE FROM portal_designs WHERE id = ?', [designId]);
}

async function clearDesignLinks(designId) {
  await run('DELETE FROM portal_design_links WHERE design_id_2d = ? OR design_id_3d = ?', [designId, designId]);
}

async function deleteDesignVersion(versionId) {
  const version = await get('SELECT id, design_id, media_id FROM portal_design_versions WHERE id = ?', [versionId]);
  if (!version) return false;
  await run('DELETE FROM portal_design_comments WHERE design_version_id = ?', [versionId]);
  await run('DELETE FROM portal_design_versions WHERE id = ?', [versionId]);
  await run('DELETE FROM portal_media WHERE id = ?', [version.media_id]);
  const remaining = await get('SELECT COUNT(*) AS c FROM portal_design_versions WHERE design_id = ?', [version.design_id]);
  if (remaining && remaining.c === 0) {
    await clearDesignLinks(version.design_id);
    await run('DELETE FROM portal_designs WHERE id = ?', [version.design_id]);
  }
  return true;
}

// ----- Daily updates (text + photos/videos) -----
function normalizeDailyReportDate(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

async function createDailyUpdate(projectId, authorType, authorId, text, reportDate) {
  const id = uuid();
  const visibleToClient = String(authorType).toUpperCase() === 'DESIGNER' ? 0 : 1;
  const rd = normalizeDailyReportDate(reportDate);
  await run(
    'INSERT INTO portal_daily_updates (id, project_id, author_type, author_id, text, visible_to_client, report_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, authorType, authorId || null, text || null, visibleToClient, rd]
  );
  return id;
}

async function setDailyUpdateVisibleToClient(projectId, updateId, visible) {
  const u = await get('SELECT id FROM portal_daily_updates WHERE id = ? AND project_id = ?', [updateId, projectId]);
  if (!u) return false;
  await run('UPDATE portal_daily_updates SET visible_to_client = ? WHERE id = ?', [visible ? 1 : 0, updateId]);
  return true;
}

async function addDailyUpdateMedia(updateId, url, type, fileName, fileSize) {
  const id = uuid();
  await run(
    'INSERT INTO portal_daily_update_media (id, update_id, url, type, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?)',
    [id, updateId, url, type, fileName || null, fileSize || null]
  );
  return id;
}

async function getDailyUpdatesByProject(projectId) {
  const updates = await all(
    `SELECT * FROM portal_daily_updates WHERE project_id = ?
     ORDER BY COALESCE(report_date, date(created_at)) DESC, datetime(created_at) DESC`,
    [projectId]
  );
  for (const u of updates) {
    u.media = await all(
      'SELECT * FROM portal_daily_update_media WHERE update_id = ? ORDER BY created_at ASC',
      [u.id]
    );
  }
  return updates;
}

async function getDailyUpdateById(updateId) {
  return get('SELECT * FROM portal_daily_updates WHERE id = ?', [updateId]);
}

async function updateDailyUpdateText(updateId, text, reportDate) {
  const textVal = text != null && String(text).trim() ? String(text).trim() : null;
  if (reportDate === undefined) {
    await run('UPDATE portal_daily_updates SET text = ? WHERE id = ?', [textVal, updateId]);
    return;
  }
  const rd = normalizeDailyReportDate(reportDate);
  await run('UPDATE portal_daily_updates SET text = ?, report_date = ? WHERE id = ?', [textVal, rd, updateId]);
}

async function deleteDailyUpdateForProject(projectId, updateId) {
  const u = await get('SELECT id FROM portal_daily_updates WHERE id = ? AND project_id = ?', [updateId, projectId]);
  if (!u) return false;
  await run('DELETE FROM portal_daily_update_media WHERE update_id = ?', [updateId]);
  await run('DELETE FROM portal_daily_updates WHERE id = ?', [updateId]);
  return true;
}

async function deleteDailyUpdateMediaForProject(projectId, mediaId) {
  const row = await get(
    `SELECT m.id FROM portal_daily_update_media m
     INNER JOIN portal_daily_updates u ON u.id = m.update_id
     WHERE m.id = ? AND u.project_id = ?`,
    [mediaId, projectId]
  );
  if (!row) return false;
  await run('DELETE FROM portal_daily_update_media WHERE id = ?', [mediaId]);
  return true;
}

// ----- Invoices -----
async function createInvoice(projectId, totalAmount, pdfUrl) {
  const id = uuid();
  await run('INSERT INTO portal_invoices (id, project_id, total_amount, pdf_url) VALUES (?, ?, ?, ?)', [id, projectId, totalAmount, pdfUrl]);
  return id;
}

// ----- Complaints -----
async function getComplaintsByProjectId(projectId) {
  return all('SELECT * FROM portal_complaints WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
}

// ----- Notifications -----
async function insertPortalNotification(userId, message, opts = {}) {
  const id = uuid();
  const category = opts.category || 'SYSTEM';
  const linkUrl = opts.linkUrl !== undefined ? opts.linkUrl : null;
  const projectId = opts.projectId !== undefined ? opts.projectId : null;
  await run(
    'INSERT INTO portal_notifications (id, user_id, message, category, link_url, project_id, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
    [id, userId, message, category, linkUrl, projectId]
  );
  return id;
}

/** @param {object} [maybeOpts] category, linkUrl, projectId */
async function createNotification(userId, message, maybeOpts) {
  if (maybeOpts && typeof maybeOpts === 'object') {
    return insertPortalNotification(userId, message, maybeOpts);
  }
  return insertPortalNotification(userId, message, { category: 'SYSTEM' });
}

async function getNotificationsForUser(userId, limit = 50) {
  return all('SELECT * FROM portal_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
}

async function countUnreadNotifications(userId) {
  const row = await get(
    'SELECT COUNT(*) AS c FROM portal_notifications WHERE user_id = ? AND read_at IS NULL',
    [userId]
  );
  return row && row.c != null ? Number(row.c) : 0;
}

async function getPortalNotificationForUser(notificationId, userId) {
  return get('SELECT id, link_url FROM portal_notifications WHERE id = ? AND user_id = ?', [notificationId, userId]);
}

async function markNotificationRead(notificationId, userId) {
  const r = await run(
    "UPDATE portal_notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL",
    [notificationId, userId]
  );
  return r.changes > 0;
}

async function markAllNotificationsRead(userId) {
  await run("UPDATE portal_notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", [userId]);
}

async function getNotificationRoutingRow(category) {
  return get('SELECT * FROM portal_notification_routing WHERE category = ?', [category]);
}

async function getAllNotificationRouting() {
  return all('SELECT * FROM portal_notification_routing ORDER BY category ASC');
}

async function updateNotificationRouting(category, notifyClient, notifyAdmin, notifyDesigner) {
  await run(
    'UPDATE portal_notification_routing SET notify_client = ?, notify_admin = ?, notify_designer = ? WHERE category = ?',
    [notifyClient ? 1 : 0, notifyAdmin ? 1 : 0, notifyDesigner ? 1 : 0, category]
  );
}

module.exports = {
  run,
  get,
  all,
  createUser,
  getUserByEmail,
  getUserById,
  getUsersByRole,
  updateDvPoints,
  createLead,
  getLeadById,
  getLeadByConvertedProjectId,
  getLeadsForAdmin,
  getLeadsByReferrerId,
  getLeadsForDesigner,
  updateLead,
  addLeadActivity,
  getLeadActivities,
  createProject,
  getProjectById,
  getProjectWithRelations,
  getProjectsForAdmin,
  getProjectsForDesigner,
  getProjectsForClient,
  CLIENT_PORTAL_TAB_KEYS,
  DESIGNER_PORTAL_TAB_KEYS,
  defaultClientTabsJson,
  defaultDesignerTabsJson,
  parseAllowedTabsJson,
  parseDesignerTabsJson,
  designerHasProjectAccess,
  getDesignerProjectPortalAccess,
  ensureProjectDesignerRow,
  setProjectPrimaryDesignerAndSyncJunction,
  getProjectDesignersWithUsers,
  addProjectDesigner,
  removeProjectDesigner,
  updateProjectDesignerTabs,
  getProjectDesignerRecipientUserIds,
  ensureProjectMemberRow,
  getProjectMembersWithUsers,
  getClientProjectPortalAccess,
  updateProjectMemberTabs,
  addProjectMember,
  removeProjectMember,
  getProjectClientRecipientUserIds,
  canAccessProjectCctv,
  updateProject,
  getTimelineExtensions,
  getTimelineExtensionById,
  createTimelineExtension,
  approveTimelineExtension,
  rejectTimelineExtension,
  getClientPaymentsByProject,
  getClientPaymentById,
  addClientPayment,
  setClientPaymentApprovedForClient,
  deleteClientPayment,
  getQuotationById,
  getLatestQuotationByProjectId,
  createQuotation,
  updateQuotation,
  getExtraCostById,
  getExtraCostsByQuotationId,
  createExtraCost,
  updateExtraCost,
  addExtraCostComment,
  getCommentsByExtraCostId,
  getCommentsByExtraCostIds,
  getProjectMedia,
  addProjectMedia,
  deleteProjectMedia,
  createDesign,
  getDesignById,
  getDesignsByProject,
  getMaterialSelectionsForProject,
  getMaterialSelectionById,
  createMaterialSelection,
  deleteMaterialSelection,
  setMaterialSelectionClientStatus,
  getDesignVersions,
  getDesignVersionById,
  createDesignVersion,
  updateDesignVersion,
  getDesignLinksForProject,
  getLinkedDesignIds,
  addDesignLink,
  removeDesignLink,
  clearDesignLinks,
  getDesignCommentsByVersionIds,
  addDesignComment,
  getDesignsForProjectWithDetails,
  getPendingDesignVersionsForProject,
  deleteDesign,
  deleteDesignVersion,
  DESIGN_ADMIN_STATUS,
  DESIGN_CLIENT_STATUS,
  createDailyUpdate,
  addDailyUpdateMedia,
  getDailyUpdatesByProject,
  setDailyUpdateVisibleToClient,
  getDailyUpdateById,
  updateDailyUpdateText,
  deleteDailyUpdateForProject,
  deleteDailyUpdateMediaForProject,
  updateOtherDocMedia,
  approveSiteLogOrOfficialForClient,
  createInvoice,
  getComplaintsByProjectId,
  createNotification,
  insertPortalNotification,
  getNotificationsForUser,
  countUnreadNotifications,
  getPortalNotificationForUser,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationRoutingRow,
  getAllNotificationRouting,
  updateNotificationRouting,
};
