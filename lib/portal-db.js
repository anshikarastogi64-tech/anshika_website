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
  const allowed = ['title', 'budget', 'current_stage', 'status', 'rtsp_link', 'personality_pdf_url', 'final_total_cost', 'dv_points_processed', 'invoice_locked', 'designer_id'];
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
  const allowed = ['base_total', 'items', 'status', 'client_comments', 'approved_at', 'is_final'];
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

async function createExtraCost(quotationId, description, amount, comment) {
  const id = uuid();
  await run(
    'INSERT INTO portal_extra_costs (id, quotation_id, description, amount, status, comment) VALUES (?, ?, ?, ?, ?, ?)',
    [id, quotationId, description, amount, 'PENDING', comment || null]
  );
  return id;
}

async function updateExtraCost(id, updates) {
  const allowed = ['status', 'client_note', 'approved_at'];
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

// ----- Media (Vault) -----
async function getProjectMedia(projectId, category = null) {
  if (category) {
    return all('SELECT * FROM portal_media WHERE project_id = ? AND category = ? ORDER BY created_at ASC', [projectId, category]);
  }
  return all('SELECT * FROM portal_media WHERE project_id = ? ORDER BY category, created_at ASC', [projectId]);
}

async function addProjectMedia(projectId, url, type, category, fileName = null, fileSize = null) {
  const id = uuid();
  await run(
    'INSERT INTO portal_media (id, project_id, url, type, category, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, url, type, category, fileName, fileSize]
  );
  return id;
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
  getProjectMedia,
  addProjectMedia,
  createInvoice,
  getComplaintsByProjectId,
};
