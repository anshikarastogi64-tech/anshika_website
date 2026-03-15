/**
 * Luxury Interior Portal routes
 * /portal/login, /portal/admin, /portal/designer, /portal/client, /portal/mirror/:projectId
 */
const path = require('path');
const ejs = require('ejs');
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const portalDb = require('../lib/portal-db');
const { sendWelcomeEmail } = require('../lib/portal-email');
const { LIFECYCLE_STAGES, calculateProjectTotal, uuid, LEAD_STATUSES, groupMediaByDate } = require('../lib/portal');
const multer = require('multer');
const fs = require('fs');

async function renderPortal(req, res, view, data = {}) {
  const merged = { ...res.locals, ...data };
  try {
    const bodyHtml = await ejs.renderFile(path.join(__dirname, '..', 'views', view + '.ejs'), merged);
    res.render('portal/layout', { ...merged, body: bodyHtml });
  } catch (e) {
    res.status(500).send(String(e));
  }
}

// Session keys for portal
const PORTAL_USER_ID = 'portalUserId';
const PORTAL_USER_EMAIL = 'portalUserEmail';
const PORTAL_USER_ROLE = 'portalUserRole';
const PORTAL_USER_NAME = 'portalUserName';

function requirePortalAuth(req, res, next) {
  if (!req.session[PORTAL_USER_ID]) {
    return res.redirect('/portal/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.session[PORTAL_USER_ROLE] !== 'ADMIN') {
    return res.status(403).send('Forbidden');
  }
  next();
}

function requireDesigner(req, res, next) {
  if (req.session[PORTAL_USER_ROLE] !== 'DESIGNER' && req.session[PORTAL_USER_ROLE] !== 'ADMIN') {
    return res.status(403).send('Forbidden');
  }
  next();
}

function requireClient(req, res, next) {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT' && req.session[PORTAL_USER_ROLE] !== 'ADMIN' && req.session[PORTAL_USER_ROLE] !== 'DESIGNER') {
    return res.status(403).send('Forbidden');
  }
  next();
}

// ----- Auth -----
router.get('/login', (req, res) => {
  if (req.session[PORTAL_USER_ID]) {
    const role = req.session[PORTAL_USER_ROLE];
    if (role === 'ADMIN') return res.redirect('/portal/admin');
    if (role === 'DESIGNER') return res.redirect('/portal/designer');
    return res.redirect('/portal/client');
  }
  res.render('portal/login', { error: '' });
});

router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.render('portal/login', { error: 'Email and password required.' });
  }
  try {
    const user = await portalDb.getUserByEmail(email.trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.render('portal/login', { error: 'Invalid email or password.' });
    }
    req.session[PORTAL_USER_ID] = user.id;
    req.session[PORTAL_USER_EMAIL] = user.email;
    req.session[PORTAL_USER_ROLE] = user.role;
    req.session[PORTAL_USER_NAME] = user.full_name;
    if (user.role === 'ADMIN') return res.redirect('/portal/admin');
    if (user.role === 'DESIGNER') return res.redirect('/portal/designer');
    return res.redirect('/portal/client');
  } catch (e) {
    return res.render('portal/login', { error: 'Login failed. Try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.session[PORTAL_USER_ID] = null;
  req.session[PORTAL_USER_EMAIL] = null;
  req.session[PORTAL_USER_ROLE] = null;
  req.session[PORTAL_USER_NAME] = null;
  res.redirect('/portal/login');
});

// Static path routes registered first so they are not matched as :id (e.g. "new")
router.get('/admin/leads/new', requirePortalAuth, requireAdmin, (req, res, next) => {
  res.locals.portalUser = { id: req.session[PORTAL_USER_ID], email: req.session[PORTAL_USER_EMAIL], role: req.session[PORTAL_USER_ROLE], name: req.session[PORTAL_USER_NAME] };
  res.locals.LIFECYCLE_STAGES = LIFECYCLE_STAGES;
  next();
}, async (req, res) => {
  const designers = await portalDb.getUsersByRole('DESIGNER');
  renderPortal(req, res, 'portal/admin/lead_form', { lead: null, designers, query: req.query });
});
router.get('/admin/projects/new', requirePortalAuth, requireAdmin, (req, res, next) => {
  res.locals.portalUser = { id: req.session[PORTAL_USER_ID], email: req.session[PORTAL_USER_EMAIL], role: req.session[PORTAL_USER_ROLE], name: req.session[PORTAL_USER_NAME] };
  res.locals.LIFECYCLE_STAGES = LIFECYCLE_STAGES;
  next();
}, async (req, res) => {
  const clients = await portalDb.getUsersByRole('CLIENT');
  const designers = await portalDb.getUsersByRole('DESIGNER');
  renderPortal(req, res, 'portal/admin/project_form', { project: null, clients, designers, query: req.query });
});
router.get('/client/refer', requirePortalAuth, (req, res, next) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.redirect('/portal/client');
  res.locals.portalUser = { id: req.session[PORTAL_USER_ID], email: req.session[PORTAL_USER_EMAIL], role: req.session[PORTAL_USER_ROLE], name: req.session[PORTAL_USER_NAME] };
  res.locals.LIFECYCLE_STAGES = LIFECYCLE_STAGES;
  next();
}, async (req, res) => {
  renderPortal(req, res, 'portal/client/refer_form', { error: '', query: req.query });
});

// ----- Portal layout locals -----
router.use(requirePortalAuth, (req, res, next) => {
  res.locals.portalUser = {
    id: req.session[PORTAL_USER_ID],
    email: req.session[PORTAL_USER_EMAIL],
    role: req.session[PORTAL_USER_ROLE],
    name: req.session[PORTAL_USER_NAME],
  };
  res.locals.LIFECYCLE_STAGES = LIFECYCLE_STAGES;
  next();
});

// ----- Admin Dashboard -----
router.get('/admin', requirePortalAuth, requireAdmin, async (req, res) => {
  try {
    const [users, leads, projects] = await Promise.all([
      portalDb.get('SELECT COUNT(*) AS c FROM portal_users'),
      portalDb.get('SELECT COUNT(*) AS c FROM portal_leads'),
      portalDb.get('SELECT COUNT(*) AS c FROM portal_projects'),
    ]);
    const counts = {
      users: users?.c ?? 0,
      leads: leads?.c ?? 0,
      projects: projects?.c ?? 0,
    };
    renderPortal(req, res, 'portal/admin/dashboard', { counts });
  } catch (e) {
    res.status(500).send('Error: ' + (e && e.message));
  }
});

// ----- Admin: Users -----
router.get('/admin/users', requirePortalAuth, requireAdmin, async (req, res) => {
  const users = await portalDb.all('SELECT id, email, full_name, role, dv_points_balance, created_at FROM portal_users ORDER BY role, full_name');
  renderPortal(req, res, 'portal/admin/users', { users });
});

router.get('/admin/users/new', requirePortalAuth, requireAdmin, async (req, res) => {
  const designers = await portalDb.getUsersByRole('DESIGNER');
  renderPortal(req, res, 'portal/admin/user_form', { user: null, designers, query: req.query });
});

router.post('/admin/users/new', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const { email, full_name, role, password } = req.body || {};
  if (!email || !full_name || !role || !password) {
    return res.redirect('/portal/admin/users/new?error=Missing+fields');
  }
  try {
    const existing = await portalDb.getUserByEmail(email.trim());
    if (existing) return res.redirect('/portal/admin/users/new?error=Email+already+exists');
    const hash = bcrypt.hashSync(password, 10);
    await portalDb.createUser({
      email: email.trim(),
      passwordHash: hash,
      fullName: full_name.trim(),
      role: role.toUpperCase(),
    });
    res.redirect('/portal/admin/users');
  } catch (e) {
    res.redirect('/portal/admin/users/new?error=Error');
  }
});

// ----- Admin: Leads (static /new before /:id so "new" is not treated as id) -----
router.get('/admin/leads', requirePortalAuth, requireAdmin, async (req, res) => {
  const leads = await portalDb.getLeadsForAdmin();
  renderPortal(req, res, 'portal/admin/leads', { leads });
});

router.post('/admin/leads/new', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const { name, phone_number, email, assigned_designer_id } = req.body || {};
  if (!name || !phone_number) return res.redirect('/portal/admin/leads/new?error=Name+and+phone+required');
  await portalDb.createLead({ name, phone_number, email: email || null, assigned_designer_id: assigned_designer_id || null });
  res.redirect('/portal/admin/leads');
});

router.get('/admin/leads/:id', requirePortalAuth, requireAdmin, async (req, res) => {
  const lead = await portalDb.getLeadById(req.params.id);
  if (!lead) return res.status(404).send('Lead not found');
  const [activities, designers, referrer] = await Promise.all([
    portalDb.getLeadActivities(lead.id),
    portalDb.getUsersByRole('DESIGNER'),
    lead.referrer_id ? portalDb.getUserById(lead.referrer_id) : null,
  ]);
  const leadWithReferrer = referrer ? { ...lead, referrer_name: referrer.full_name } : lead;
  renderPortal(req, res, 'portal/admin/lead_detail', { lead: leadWithReferrer, activities, designers });
});

router.post('/admin/leads/:id/assign', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  await portalDb.updateLead(req.params.id, { assigned_designer_id: req.body.designer_id || null });
  res.redirect('/portal/admin/leads/' + req.params.id);
});

router.post('/admin/leads/:id/note', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const note = (req.body.note || '').trim();
  if (note) await portalDb.addLeadActivity(req.params.id, note);
  res.redirect('/portal/admin/leads/' + req.params.id);
});

// ----- Admin: Projects (static /new before /:id) -----
router.get('/admin/projects', requirePortalAuth, requireAdmin, async (req, res) => {
  const projects = await portalDb.getProjectsForAdmin();
  renderPortal(req, res, 'portal/admin/projects', { projects });
});

router.post('/admin/projects/new', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const { title, budget, client_id, designer_id } = req.body || {};
  if (!title || !client_id || !designer_id) return res.redirect('/portal/admin/projects/new?error=Required+fields+missing');
  const projectId = await portalDb.createProject({
    title: title.trim(),
    budget: parseFloat(budget) || 0,
    client_id,
    designer_id,
  });
  await portalDb.createQuotation(projectId, parseFloat(budget) || 0, []);
  const client = await portalDb.getUserById(client_id);
  const baseUrl = req.protocol + '://' + req.get('host');
  sendWelcomeEmail({
    toEmail: client.email,
    clientName: client.full_name,
    portalUrl: baseUrl + '/portal/login',
    loginEmail: client.email,
    tempPassword: null,
  }).catch(() => {});
  res.redirect('/portal/admin/projects/' + projectId);
});

router.get('/admin/projects/:id', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectWithRelations(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  let extraCosts = [];
  if (quotation) extraCosts = await portalDb.getExtraCostsByQuotationId(quotation.id);
  const total = calculateProjectTotal(quotation, extraCosts);
  const designers = await portalDb.getUsersByRole('DESIGNER');
  renderPortal(req, res, 'portal/admin/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    designers,
    isMirror: false,
  });
});

router.post('/admin/projects/:id/assign', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const designer_id = (req.body.designer_id || '').trim() || null;
  if (!designer_id) return res.redirect('/portal/admin/projects/' + req.params.id);
  await portalDb.updateProject(req.params.id, { designer_id });
  res.redirect('/portal/admin/projects/' + req.params.id);
});

router.post('/admin/projects/:id/complete', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const quotation = await portalDb.getLatestQuotationByProjectId(projectId);
  const extraCosts = quotation ? await portalDb.getExtraCostsByQuotationId(quotation.id) : [];
  const finalTotal = calculateProjectTotal(quotation, extraCosts);
  await portalDb.updateProject(projectId, { status: 'COMPLETED', final_total_cost: finalTotal, dv_points_processed: 1 });
  const lead = await portalDb.getLeadByConvertedProjectId(projectId);
  if (lead && lead.referrer_id) {
    const reward = finalTotal * 0.04;
    await portalDb.updateDvPoints(lead.referrer_id, reward);
  }
  res.redirect('/portal/admin/projects/' + projectId);
});

// ----- Designer Dashboard -----
router.get('/designer', requirePortalAuth, requireDesigner, async (req, res) => {
  const designerId = req.session[PORTAL_USER_ID];
  const [leads, projects] = await Promise.all([
    portalDb.getLeadsForDesigner(designerId),
    portalDb.getProjectsForDesigner(designerId),
  ]);
  const pendingFollowUps = leads.filter((l) => l.next_follow_up && new Date(l.next_follow_up) <= new Date());
  renderPortal(req, res, 'portal/designer/dashboard', { leads, projects, pendingFollowUps });
});

router.get('/designer/leads', requirePortalAuth, requireDesigner, async (req, res) => {
  const leads = await portalDb.getLeadsForDesigner(req.session[PORTAL_USER_ID]);
  renderPortal(req, res, 'portal/designer/leads', { leads });
});

router.get('/designer/leads/:id', requirePortalAuth, requireDesigner, async (req, res) => {
  const lead = await portalDb.getLeadById(req.params.id);
  if (!lead) return res.status(404).send('Lead not found');
  if (lead.assigned_designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN') {
    return res.status(403).send('Forbidden');
  }
  const activities = await portalDb.getLeadActivities(lead.id);
  renderPortal(req, res, 'portal/designer/lead_detail', { lead, activities });
});

router.post('/designer/leads/:id/note', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const lead = await portalDb.getLeadById(req.params.id);
  if (!lead || (lead.assigned_designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) {
    return res.status(403).send('Forbidden');
  }
  const note = (req.body.note || '').trim();
  if (note) await portalDb.addLeadActivity(req.params.id, note);
  res.redirect('/portal/designer/leads/' + req.params.id);
});

router.post('/designer/leads/:id/update', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const lead = await portalDb.getLeadById(req.params.id);
  if (!lead || (lead.assigned_designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) {
    return res.status(403).send('Forbidden');
  }
  const updates = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.next_follow_up !== undefined) updates.next_follow_up = req.body.next_follow_up || null;
  if (Object.keys(updates).length) await portalDb.updateLead(req.params.id, updates);
  res.redirect('/portal/designer/leads/' + req.params.id);
});

router.get('/designer/leads/:id/convert', requirePortalAuth, requireDesigner, async (req, res) => {
  const lead = await portalDb.getLeadById(req.params.id);
  if (!lead) return res.status(404).send('Lead not found');
  const clients = await portalDb.getUsersByRole('CLIENT');
  renderPortal(req, res, 'portal/designer/convert_lead', { lead, clients });
});

router.post('/designer/leads/:id/convert', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const lead = await portalDb.getLeadById(req.params.id);
  if (!lead) return res.status(404).send('Lead not found');
  const { client_id } = req.body || {};
  if (!client_id) return res.redirect('/portal/designer/leads/' + req.params.id + '/convert?error=Select+client');
  const projectId = await portalDb.createProject({
    title: lead.name + ' – Project',
    budget: 0,
    client_id,
    designer_id: lead.assigned_designer_id || req.session[PORTAL_USER_ID],
  });
  await portalDb.createQuotation(projectId, 0, []);
  await portalDb.updateLead(req.params.id, { status: 'CONVERTED', converted_project_id: projectId });
  const client = await portalDb.getUserById(client_id);
  const baseUrl = req.protocol + '://' + req.get('host');
  sendWelcomeEmail({
    toEmail: client.email,
    clientName: client.full_name,
    portalUrl: baseUrl + '/portal/login',
    loginEmail: client.email,
    tempPassword: null,
  }).catch(() => {});
  res.redirect('/portal/designer/projects/' + projectId);
});

router.get('/designer/projects', requirePortalAuth, requireDesigner, async (req, res) => {
  const projects = await portalDb.getProjectsForDesigner(req.session[PORTAL_USER_ID]);
  renderPortal(req, res, 'portal/designer/projects', { projects });
});

router.get('/designer/projects/:id', requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectWithRelations(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  if (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN') {
    return res.status(403).send('Forbidden');
  }
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  let extraCosts = [];
  if (quotation) extraCosts = await portalDb.getExtraCostsByQuotationId(quotation.id);
  const total = calculateProjectTotal(quotation, extraCosts);
  const media = await portalDb.getProjectMedia(project.id);
  renderPortal(req, res, 'portal/designer/project_detail', { project, quotation, extraCosts, total, media });
});

router.post('/designer/projects/:id/update', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) {
    return res.status(403).send('Forbidden');
  }
  const updates = {};
  if (req.body.current_stage !== undefined) updates.current_stage = parseInt(req.body.current_stage, 10);
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.rtsp_link !== undefined) updates.rtsp_link = req.body.rtsp_link || null;
  if (Object.keys(updates).length) await portalDb.updateProject(req.params.id, updates);
  res.redirect('/portal/designer/projects/' + req.params.id);
});

const portalUploadDir = path.join(__dirname, '..', 'Kelly', 'assets', 'uploads', 'portal');
if (!fs.existsSync(portalUploadDir)) fs.mkdirSync(portalUploadDir, { recursive: true });
const portalUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, portalUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'file').replace(/\s/g, '-')),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/designer/projects/:id/media', requirePortalAuth, requireDesigner, portalUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) {
    return res.status(403).send('Forbidden');
  }
  const category = (req.body?.category || 'SITE_LOG').toUpperCase();
  if (!req.file) return res.redirect('/portal/designer/projects/' + projectId + '?msg=No+file');
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  await portalDb.addProjectMedia(projectId, url, req.file.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO', category, req.file.originalname, req.file.size);
  res.redirect('/portal/designer/projects/' + projectId);
});

// ----- Client Dashboard -----
router.get('/client', requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.redirect('/portal/' + (req.session[PORTAL_USER_ROLE] === 'ADMIN' ? 'admin' : 'designer'));
  const [projects, user, referrals] = await Promise.all([
    portalDb.getProjectsForClient(req.session[PORTAL_USER_ID]),
    portalDb.getUserById(req.session[PORTAL_USER_ID]),
    portalDb.getLeadsByReferrerId(req.session[PORTAL_USER_ID]),
  ]);
  renderPortal(req, res, 'portal/client/dashboard', { projects, dvPoints: user?.dv_points_balance ?? 0, referrals: referrals || [], query: req.query });
});

router.post('/client/refer', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const { name, phone_number, email } = req.body || {};
  if (!name || !phone_number) return res.redirect('/portal/client/refer?error=Name+and+phone+required');
  await portalDb.createLead({
    name: name.trim(),
    phone_number: phone_number.trim(),
    email: (email || '').trim() || null,
    referrer_id: req.session[PORTAL_USER_ID],
    status: 'NEW',
  });
  res.redirect('/portal/client?msg=Referral+submitted');
});

router.get('/client/projects/:id', requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || project.client_id !== req.session[PORTAL_USER_ID]) return res.status(403).send('Forbidden');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  let extraCosts = [];
  if (quotation) extraCosts = await portalDb.getExtraCostsByQuotationId(quotation.id);
  const total = calculateProjectTotal(quotation, extraCosts);
  const media = await portalDb.getProjectMedia(project.id);
  const siteLog = (media || []).filter((m) => m.category === 'SITE_LOG');
  const other = (media || []).filter((m) => m.category !== 'SITE_LOG');
  const byYearMonth = groupMediaByDate(siteLog);
  const otherByCat = {};
  other.forEach((m) => {
    if (!otherByCat[m.category]) otherByCat[m.category] = [];
    otherByCat[m.category].push(m);
  });
  renderPortal(req, res, 'portal/client/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    media,
    byYearMonth,
    otherByCat,
    readOnly: false,
  });
});

// ----- Mirror Mode (Admin/Designer view as client) -----
router.get('/mirror/:projectId', requirePortalAuth, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.projectId);
  if (!project) return res.status(404).send('Project not found');
  const isAdmin = req.session[PORTAL_USER_ROLE] === 'ADMIN';
  const isAssignedDesigner = project.designer_id === req.session[PORTAL_USER_ID];
  if (!isAdmin && !isAssignedDesigner) return res.status(403).send('Forbidden');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  let extraCosts = [];
  if (quotation) extraCosts = await portalDb.getExtraCostsByQuotationId(quotation.id);
  const total = calculateProjectTotal(quotation, extraCosts);
  const media = await portalDb.getProjectMedia(project.id);
  const siteLog = (media || []).filter((m) => m.category === 'SITE_LOG');
  const other = (media || []).filter((m) => m.category !== 'SITE_LOG');
  const byYearMonth = groupMediaByDate(siteLog);
  const otherByCat = {};
  other.forEach((m) => {
    if (!otherByCat[m.category]) otherByCat[m.category] = [];
    otherByCat[m.category].push(m);
  });
  res.locals.mirrorBanner = true;
  renderPortal(req, res, 'portal/client/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    media,
    byYearMonth,
    otherByCat,
    readOnly: true,
  });
});

// ----- API: Quotation total (for live updates) -----
router.get('/api/quotation/:projectId/total', requirePortalAuth, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const canAccess =
    req.session[PORTAL_USER_ROLE] === 'ADMIN' ||
    project.designer_id === req.session[PORTAL_USER_ID] ||
    project.client_id === req.session[PORTAL_USER_ID];
  if (!canAccess) return res.status(403).json({ error: 'Forbidden' });
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  const extraCosts = quotation ? await portalDb.getExtraCostsByQuotationId(quotation.id) : [];
  const total = calculateProjectTotal(quotation, extraCosts);
  res.json({ total });
});

// ----- Client: Approve quotation -----
router.post('/api/quotation/:id/approve', express.json(), express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  const q = await portalDb.getQuotationById(req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const project = await portalDb.getProjectById(q.project_id);
  if (!project || project.client_id !== req.session[PORTAL_USER_ID]) return res.status(403).json({ error: 'Forbidden' });
  await portalDb.updateQuotation(req.params.id, { status: 'APPROVED' });
  res.json({ ok: true });
});

router.post('/api/extra-cost/:id/approve', requirePortalAuth, async (req, res) => {
  const ec = await portalDb.getExtraCostById(req.params.id);
  if (!ec) return res.status(404).json({ error: 'Not found' });
  const q = await portalDb.getQuotationById(ec.quotation_id);
  const project = await portalDb.getProjectById(q.project_id);
  if (!project || project.client_id !== req.session[PORTAL_USER_ID]) return res.status(403).json({ error: 'Forbidden' });
  await portalDb.updateExtraCost(req.params.id, { status: 'APPROVED' });
  res.json({ ok: true });
});

router.post('/api/extra-cost/:id/reject', requirePortalAuth, async (req, res) => {
  const ec = await portalDb.getExtraCostById(req.params.id);
  if (!ec) return res.status(404).json({ error: 'Not found' });
  const q = await portalDb.getQuotationById(ec.quotation_id);
  const project = await portalDb.getProjectById(q.project_id);
  if (!project || project.client_id !== req.session[PORTAL_USER_ID]) return res.status(403).json({ error: 'Forbidden' });
  await portalDb.updateExtraCost(req.params.id, { status: 'REJECTED' });
  res.json({ ok: true });
});

module.exports = router;
