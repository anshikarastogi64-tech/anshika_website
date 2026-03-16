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
    `SELECT p.*, c.full_name AS client_name
     FROM portal_projects p
     JOIN portal_users c ON p.client_id = c.id
     WHERE p.designer_id = ?
     ORDER BY p.created_at DESC`,
    [designerId]
  );
}

async function getProjectsForClient(clientId) {
  return all(
    'SELECT * FROM portal_projects WHERE client_id = ? ORDER BY created_at DESC',
    [clientId]
  );
}

async function updateProject(id, updates) {
  const allowed = ['title', 'budget', 'current_stage', 'status', 'rtsp_link', 'personality_pdf_url', 'final_total_cost', 'dv_points_processed', 'invoice_locked', 'designer_id', 'designer_can_see_finance', 'designer_can_view_mirror'];
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

async function addProjectMedia(projectId, url, type, category, fileName = null, fileSize = null, vastuCategoryName = null) {
  const id = uuid();
  await run(
    'INSERT INTO portal_media (id, project_id, url, type, category, file_name, file_size, approved, vastu_category_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, url, type, category, fileName, fileSize, (category === 'WARRANTY_GUARANTEE' || category === 'VASTU') ? 0 : 1, vastuCategoryName]
  );
  return id;
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
async function createDailyUpdate(projectId, authorType, authorId, text) {
  const id = uuid();
  await run(
    'INSERT INTO portal_daily_updates (id, project_id, author_type, author_id, text) VALUES (?, ?, ?, ?, ?)',
    [id, projectId, authorType, authorId || null, text || null]
  );
  return id;
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
    'SELECT * FROM portal_daily_updates WHERE project_id = ? ORDER BY created_at DESC',
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

// ----- Notifications (DV Points etc.) -----
async function createNotification(userId, message) {
  const id = uuid();
  await run('INSERT INTO portal_notifications (id, user_id, message) VALUES (?, ?, ?)', [id, userId, message]);
  return id;
}

async function getNotificationsForUser(userId, limit = 20) {
  return all('SELECT * FROM portal_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
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
  updateProject,
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
  createInvoice,
  getComplaintsByProjectId,
  createNotification,
  getNotificationsForUser,
};
