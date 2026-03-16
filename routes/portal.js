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
const { LIFECYCLE_STAGES, calculateProjectTotal, uuid, LEAD_STATUSES, groupMediaByDate, buildVaultMediaList } = require('../lib/portal');
const multer = require('multer');
const fs = require('fs');

const portalUploadDir = path.join(__dirname, '..', 'Kelly', 'assets', 'uploads', 'portal');
if (!fs.existsSync(portalUploadDir)) fs.mkdirSync(portalUploadDir, { recursive: true });
const portalUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, portalUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'file').replace(/\s/g, '-')),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

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
  const ecIds = extraCosts.map((e) => e.id);
  const allComments = ecIds.length ? await portalDb.getCommentsByExtraCostIds(ecIds) : [];
  const commentsByEc = {};
  allComments.forEach((c) => { if (!commentsByEc[c.extra_cost_id]) commentsByEc[c.extra_cost_id] = []; commentsByEc[c.extra_cost_id].push(c); });
  extraCosts.forEach((ec) => { ec.comments = commentsByEc[ec.id] || []; });
  const total = calculateProjectTotal(quotation, extraCosts);
  const [designers, media] = await Promise.all([
    portalDb.getUsersByRole('DESIGNER'),
    portalDb.getProjectMedia(project.id),
  ]);
  const mediaList = media || [];
  const siteLog = mediaList.filter((m) => m.category === 'SITE_LOG');
  const byYearMonth = groupMediaByDate(siteLog);
  const mediaByCategory = {
    ARCHITECTURAL_PLANS: mediaList.filter((m) => m.category === 'ARCHITECTURAL_PLANS'),
    VISUALIZATIONS: mediaList.filter((m) => m.category === 'VISUALIZATIONS'),
    SITE_LOG: siteLog,
    OFFICIAL_DOCS: mediaList.filter((m) => m.category === 'OFFICIAL_DOCS'),
  };
  const vaultMediaList = buildVaultMediaList(mediaList);
  const [projectDesigns, pendingDesignVersions, dailyUpdates] = await Promise.all([
    portalDb.getDesignsForProjectWithDetails(project.id, { forClient: false }),
    portalDb.getPendingDesignVersionsForProject(project.id),
    portalDb.getDailyUpdatesByProject(project.id),
  ]);
  renderPortal(req, res, 'portal/admin/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    designers,
    media: mediaList,
    mediaByCategory,
    byYearMonth,
    vaultMediaList,
    projectDesigns,
    pendingDesignVersions,
    dailyUpdates: dailyUpdates || [],
    isMirror: false,
  });
});

router.post('/admin/projects/:id/assign', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const designer_id = (req.body.designer_id || '').trim() || null;
  if (!designer_id) return res.redirect('/portal/admin/projects/' + req.params.id);
  await portalDb.updateProject(req.params.id, { designer_id });
  res.redirect('/portal/admin/projects/' + req.params.id);
});

router.post('/admin/projects/:id/designer-finance-visibility', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const designer_can_see_finance = req.body.designer_can_see_finance === '1' ? 1 : 0;
  await portalDb.updateProject(req.params.id, { designer_can_see_finance });
  res.redirect('/portal/admin/projects/' + req.params.id);
});

router.post('/admin/projects/:id/designer-mirror-visibility', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const designer_can_view_mirror = req.body.designer_can_view_mirror === '1' ? 1 : 0;
  await portalDb.updateProject(req.params.id, { designer_can_view_mirror });
  res.redirect('/portal/admin/projects/' + req.params.id);
});

// Admin Design Vault upload (2D/3D go to design review; SITE_LOG/OFFICIAL_DOCS as before)
router.post('/admin/projects/:id/media', requirePortalAuth, requireAdmin, portalUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const category = (req.body?.category || 'SITE_LOG').toUpperCase();
  if (!req.file) return res.redirect('/portal/admin/projects/' + projectId + '?msg=No+file#tab-vault');
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  const mediaId = await portalDb.addProjectMedia(projectId, url, req.file.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO', category, req.file.originalname, req.file.size);
  if (category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS') {
    const areaTag = (req.body?.area_tag || '').trim() || (req.body?.area_tag_custom || '').trim() || 'General';
    const designId = await portalDb.createDesign(projectId, category, areaTag);
    await portalDb.createDesignVersion(designId, mediaId, req.session[PORTAL_USER_ID], 'PENDING_ADMIN', 'PENDING');
  }
  res.redirect('/portal/admin/projects/' + projectId + '#tab-vault');
});

router.post('/admin/projects/:id/daily-updates', requirePortalAuth, requireAdmin, portalUpload.array('files', 20), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const text = (req.body && req.body.text) ? String(req.body.text).trim() : '';
  const files = req.files || [];
  if (!text && files.length === 0) return res.redirect('/portal/admin/projects/' + projectId + '?msg=Add+text+or+files#tab-daily');
  const updateId = await portalDb.createDailyUpdate(projectId, 'ADMIN', req.session[PORTAL_USER_ID], text || null);
  for (const f of files) {
    const url = '/assets/uploads/portal/' + path.basename(f.filename);
    const type = f.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO';
    await portalDb.addDailyUpdateMedia(updateId, url, type, f.originalname, f.size);
  }
  res.redirect('/portal/admin/projects/' + projectId + '#tab-daily');
});

router.post('/admin/projects/:id/quotation/update', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation || !canEditQuotation(quotation)) return res.redirect('/portal/admin/projects/' + req.params.id + '?msg=Quotation+locked#tab-finance');
  const base_total = parseFloat(req.body.base_total);
  if (Number.isNaN(base_total)) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
  let items = req.body.items;
  try { items = items ? JSON.parse(items) : quotation.items ? JSON.parse(quotation.items) : []; } catch (_) { items = []; }
  await portalDb.updateQuotation(quotation.id, { base_total, items: JSON.stringify(items) });
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/quotation/upload-pdf', requirePortalAuth, requireAdmin, portalUpload.single('pdf'), async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  let quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation) {
    const qid = await portalDb.createQuotation(project.id, 0, []);
    quotation = await portalDb.getQuotationById(qid);
  }
  if (!req.file) return res.redirect('/portal/admin/projects/' + req.params.id + '?msg=Select+PDF#tab-finance');
  const pdfUrl = '/assets/uploads/portal/' + path.basename(req.file.filename);
  await portalDb.updateQuotation(quotation.id, { pdf_url: pdfUrl });
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/extra-cost', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation) return res.redirect('/portal/admin/projects/' + req.params.id + '?msg=No+quotation#tab-finance');
  const description = (req.body.description || '').trim();
  const amount = parseFloat(req.body.amount);
  if (!description || Number.isNaN(amount)) return res.redirect('/portal/admin/projects/' + req.params.id + '?msg=Description+and+amount+required#tab-finance');
  await portalDb.createExtraCost(quotation.id, description, amount, (req.body.comment || '').trim());
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/extra-cost/:ecId/respond', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const ec = await portalDb.getExtraCostById(req.params.ecId);
  if (!ec) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
  const q = await portalDb.getQuotationById(ec.quotation_id);
  if (!q || q.project_id !== project.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
  const message = (req.body.response_note != null ? String(req.body.response_note) : '').trim();
  if (message) await portalDb.addExtraCostComment(ec.id, 'ADMIN', req.session[PORTAL_USER_ID], message);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/extra-cost/:ecId/edit', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const ec = await portalDb.getExtraCostById(req.params.ecId);
  if (!ec || ec.status === 'SUPERSEDED') return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
  const q = await portalDb.getQuotationById(ec.quotation_id);
  if (!q || q.project_id !== project.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
  const description = (req.body.description || '').trim();
  const amount = parseFloat(req.body.amount);
  if (!description || Number.isNaN(amount)) return res.redirect('/portal/admin/projects/' + req.params.id + '?msg=Description+and+amount+required#tab-finance');
  await portalDb.createExtraCost(q.id, description, amount, (req.body.comment || '').trim(), ec.id);
  await portalDb.updateExtraCost(ec.id, { status: 'SUPERSEDED' });
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
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
    await portalDb.createNotification(lead.referrer_id, `You've earned ₹${Math.round(reward).toLocaleString()} DV points from your referral! (4% of project completion)`);
  }
  res.redirect('/portal/admin/projects/' + projectId);
});

// ----- Design review (2D/3D): Admin approve/reject, set client status -----
async function getDesignVersionAndProject(versionId) {
  const version = await portalDb.getDesignVersionById(versionId);
  if (!version) return { version: null, design: null, project: null };
  const design = await portalDb.getDesignById(version.design_id);
  if (!design) return { version, design: null, project: null };
  const project = await portalDb.getProjectById(design.project_id);
  return { version, design, project };
}

router.post('/admin/projects/:id/design-version/:versionId/approve', requirePortalAuth, requireAdmin, async (req, res) => {
  const { version, design, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  if (version) await portalDb.updateDesignVersion(version.id, { admin_status: 'APPROVED' });
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/design-version/:versionId/reject', requirePortalAuth, requireAdmin, async (req, res) => {
  const { version, design, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  if (version) await portalDb.updateDesignVersion(version.id, { admin_status: 'REJECTED' });
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/design-version/:versionId/set-client-status', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  const clientStatus = (req.body.client_status || '').toUpperCase();
  if (version && ['PENDING', 'APPROVED', 'DENIED'].includes(clientStatus)) {
    await portalDb.updateDesignVersion(version.id, { client_status: clientStatus });
  }
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/design-version/:versionId/comment', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  const message = (req.body.message || '').trim();
  if (version && message) await portalDb.addDesignComment(version.id, 'ADMIN', req.session[PORTAL_USER_ID], message);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/design/:designId/delete', requirePortalAuth, requireAdmin, async (req, res) => {
  const design = await portalDb.getDesignById(req.params.designId);
  if (!design || design.project_id !== req.params.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  await portalDb.deleteDesign(design.id);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/design-link', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  const designId2d = (req.body.design_id_2d || '').trim();
  const designId3d = (req.body.design_id_3d || '').trim();
  if (designId2d && designId3d) {
    const d2d = await portalDb.getDesignById(designId2d);
    const d3d = await portalDb.getDesignById(designId3d);
    if (d2d && d3d && d2d.project_id === req.params.id && d3d.project_id === req.params.id &&
        d2d.category === 'ARCHITECTURAL_PLANS' && d3d.category === 'VISUALIZATIONS') {
      await portalDb.addDesignLink(req.params.id, designId2d, designId3d);
    }
  }
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/design-link/:linkId/remove', requirePortalAuth, requireAdmin, async (req, res) => {
  await portalDb.removeDesignLink(req.params.linkId);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/media/:mediaId/delete', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  await portalDb.deleteProjectMedia(req.params.id, req.params.mediaId);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/design-version/:versionId/delete', requirePortalAuth, requireAdmin, async (req, res) => {
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  await portalDb.deleteDesignVersion(req.params.versionId);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
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
  const ecIds = extraCosts.map((e) => e.id);
  const allComments = ecIds.length ? await portalDb.getCommentsByExtraCostIds(ecIds) : [];
  const commentsByEc = {};
  allComments.forEach((c) => { if (!commentsByEc[c.extra_cost_id]) commentsByEc[c.extra_cost_id] = []; commentsByEc[c.extra_cost_id].push(c); });
  extraCosts.forEach((ec) => { ec.comments = commentsByEc[ec.id] || []; });
  const total = calculateProjectTotal(quotation, extraCosts);
  const media = await portalDb.getProjectMedia(project.id);
  const mediaList = media || [];
  const siteLog = mediaList.filter((m) => m.category === 'SITE_LOG');
  const byYearMonth = groupMediaByDate(siteLog);
  const mediaByCategory = {
    ARCHITECTURAL_PLANS: mediaList.filter((m) => m.category === 'ARCHITECTURAL_PLANS'),
    VISUALIZATIONS: mediaList.filter((m) => m.category === 'VISUALIZATIONS'),
    SITE_LOG: siteLog,
    OFFICIAL_DOCS: mediaList.filter((m) => m.category === 'OFFICIAL_DOCS'),
  };
  const vaultMediaList = buildVaultMediaList(mediaList);
  const dailyUpdates = await portalDb.getDailyUpdatesByProject(project.id);
  const projectDesigns = await portalDb.getDesignsForProjectWithDetails(project.id, { forClient: false });
  renderPortal(req, res, 'portal/designer/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    media: mediaList,
    mediaByCategory,
    byYearMonth,
    vaultMediaList,
    dailyUpdates: dailyUpdates || [],
    projectDesigns,
  });
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

router.post('/designer/projects/:id/media', requirePortalAuth, requireDesigner, portalUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) {
    return res.status(403).send('Forbidden');
  }
  const category = (req.body?.category || 'SITE_LOG').toUpperCase();
  if (!req.file) return res.redirect('/portal/designer/projects/' + projectId + '?msg=No+file#tab-vault');
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  const mediaId = await portalDb.addProjectMedia(projectId, url, req.file.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO', category, req.file.originalname, req.file.size);
  if (category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS') {
    const areaTag = (req.body?.area_tag || '').trim() || (req.body?.area_tag_custom || '').trim() || 'General';
    const designId = await portalDb.createDesign(projectId, category, areaTag);
    await portalDb.createDesignVersion(designId, mediaId, req.session[PORTAL_USER_ID], 'PENDING_ADMIN', 'PENDING');
  }
  res.redirect('/portal/designer/projects/' + projectId + '#tab-vault');
});

router.post('/designer/projects/:id/daily-updates', requirePortalAuth, requireDesigner, portalUpload.array('files', 20), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) {
    return res.status(403).send('Forbidden');
  }
  const text = (req.body && req.body.text) ? String(req.body.text).trim() : '';
  const files = req.files || [];
  if (!text && files.length === 0) return res.redirect('/portal/designer/projects/' + projectId + '?msg=Add+text+or+files#tab-daily');
  const updateId = await portalDb.createDailyUpdate(projectId, 'DESIGNER', req.session[PORTAL_USER_ID], text || null);
  for (const f of files) {
    const url = '/assets/uploads/portal/' + path.basename(f.filename);
    const type = f.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO';
    await portalDb.addDailyUpdateMedia(updateId, url, type, f.originalname, f.size);
  }
  res.redirect('/portal/designer/projects/' + projectId + '#tab-daily');
});

function canEditQuotation(quotation) {
  return quotation && quotation.status !== 'APPROVED';
}

function designerCanSeeFinance(project, session) {
  return session[PORTAL_USER_ROLE] === 'ADMIN' || (project && project.designer_can_see_finance !== 0);
}

router.post('/designer/projects/:id/quotation/update', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation || !canEditQuotation(quotation)) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=Quotation+locked#tab-finance');
  const base_total = parseFloat(req.body.base_total);
  if (Number.isNaN(base_total)) return res.redirect('/portal/designer/projects/' + req.params.id + '#tab-finance');
  let items = req.body.items;
  try { items = items ? JSON.parse(items) : quotation.items ? JSON.parse(quotation.items) : []; } catch (_) { items = []; }
  await portalDb.updateQuotation(quotation.id, { base_total, items: JSON.stringify(items) });
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-finance');
});

router.post('/designer/projects/:id/quotation/upload-pdf', requirePortalAuth, requireDesigner, portalUpload.single('pdf'), async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  let quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation) {
    const qid = await portalDb.createQuotation(project.id, 0, []);
    quotation = await portalDb.getQuotationById(qid);
  }
  if (!req.file) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=Select+PDF#tab-finance');
  const pdfUrl = '/assets/uploads/portal/' + path.basename(req.file.filename);
  await portalDb.updateQuotation(quotation.id, { pdf_url: pdfUrl });
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-finance');
});

router.post('/designer/projects/:id/extra-cost', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=No+quotation#tab-finance');
  const description = (req.body.description || '').trim();
  const amount = parseFloat(req.body.amount);
  if (!description || Number.isNaN(amount)) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=Description+and+amount+required#tab-finance');
  await portalDb.createExtraCost(quotation.id, description, amount, (req.body.comment || '').trim());
  res.redirect('/portal/designer/projects/' + req.params.id);
});

router.post('/designer/projects/:id/extra-cost/:ecId/respond', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || project.designer_id !== req.session[PORTAL_USER_ID]) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  const ec = await portalDb.getExtraCostById(req.params.ecId);
  if (!ec) return res.redirect('/portal/designer/projects/' + req.params.id);
  const q = await portalDb.getQuotationById(ec.quotation_id);
  if (!q || q.project_id !== project.id) return res.redirect('/portal/designer/projects/' + req.params.id);
  const message = (req.body.response_note != null ? String(req.body.response_note) : '').trim();
  if (message) await portalDb.addExtraCostComment(ec.id, 'DESIGNER', req.session[PORTAL_USER_ID], message);
  res.redirect('/portal/designer/projects/' + req.params.id);
});

router.post('/designer/projects/:id/extra-cost/:ecId/edit', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || project.designer_id !== req.session[PORTAL_USER_ID]) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  const ec = await portalDb.getExtraCostById(req.params.ecId);
  if (!ec || ec.status === 'SUPERSEDED') return res.redirect('/portal/designer/projects/' + req.params.id);
  const q = await portalDb.getQuotationById(ec.quotation_id);
  if (!q || q.project_id !== project.id) return res.redirect('/portal/designer/projects/' + req.params.id);
  const description = (req.body.description || '').trim();
  const amount = parseFloat(req.body.amount);
  if (!description || Number.isNaN(amount)) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=Description+and+amount+required#tab-finance');
  await portalDb.createExtraCost(q.id, description, amount, (req.body.comment || '').trim(), ec.id);
  await portalDb.updateExtraCost(ec.id, { status: 'SUPERSEDED' });
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-finance');
});

// Designer: add new version to existing design (upload)
router.post('/designer/projects/:id/design/:designId/version', requirePortalAuth, requireDesigner, portalUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) return res.status(403).send('Forbidden');
  const design = await portalDb.getDesignById(req.params.designId);
  if (!design || design.project_id !== projectId) return res.redirect('/portal/designer/projects/' + projectId + '#tab-vault');
  if (!req.file) return res.redirect('/portal/designer/projects/' + projectId + '?msg=No+file#tab-vault');
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  const mediaId = await portalDb.addProjectMedia(projectId, url, req.file.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO', design.category, req.file.originalname, req.file.size);
  // When a new version is created, do not auto-carry old 2D/3D links to this version.
  // Existing links are cleared so that designer/admin explicitly relink for the new version.
  await portalDb.clearDesignLinks(design.id);
  await portalDb.createDesignVersion(design.id, mediaId, req.session[PORTAL_USER_ID], 'PENDING_ADMIN', 'PENDING');
  res.redirect('/portal/designer/projects/' + projectId + '#tab-vault');
});

router.post('/designer/projects/:id/design/:designId/delete', requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) return res.status(403).send('Forbidden');
  const design = await portalDb.getDesignById(req.params.designId);
  if (!design || design.project_id !== req.params.id) return res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
  await portalDb.deleteDesign(design.id);
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

router.post('/designer/projects/:id/design-version/:versionId/comment', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
  const canAccess = project.designer_id === req.session[PORTAL_USER_ID] || req.session[PORTAL_USER_ROLE] === 'ADMIN';
  if (!canAccess) return res.status(403).send('Forbidden');
  const message = (req.body.message || '').trim();
  if (version && message) await portalDb.addDesignComment(version.id, 'DESIGNER', req.session[PORTAL_USER_ID], message);
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

router.post('/designer/projects/:id/design-link', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) return res.status(403).send('Forbidden');
  const designId2d = (req.body.design_id_2d || '').trim();
  const designId3d = (req.body.design_id_3d || '').trim();
  if (designId2d && designId3d) {
    const d2d = await portalDb.getDesignById(designId2d);
    const d3d = await portalDb.getDesignById(designId3d);
    if (d2d && d3d && d2d.project_id === req.params.id && d3d.project_id === req.params.id &&
        d2d.category === 'ARCHITECTURAL_PLANS' && d3d.category === 'VISUALIZATIONS') {
      await portalDb.addDesignLink(req.params.id, designId2d, designId3d);
    }
  }
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

router.post('/designer/projects/:id/design-link/:linkId/remove', requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) return res.status(403).send('Forbidden');
  await portalDb.removeDesignLink(req.params.linkId);
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

router.post('/designer/projects/:id/media/:mediaId/delete', requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (project.designer_id !== req.session[PORTAL_USER_ID] && req.session[PORTAL_USER_ROLE] !== 'ADMIN')) return res.status(403).send('Forbidden');
  await portalDb.deleteProjectMedia(req.params.id, req.params.mediaId);
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

router.post('/designer/projects/:id/design-version/:versionId/delete', requirePortalAuth, requireDesigner, async (req, res) => {
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
  const canAccess = project.designer_id === req.session[PORTAL_USER_ID] || req.session[PORTAL_USER_ROLE] === 'ADMIN';
  if (!canAccess) return res.status(403).send('Forbidden');
  // Designers must not delete versions approved by admin or client; only admins can remove those.
  if (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && version && (version.admin_status === 'APPROVED' || version.client_status === 'APPROVED')) {
    return res.status(403).send('Forbidden');
  }
  await portalDb.deleteDesignVersion(req.params.versionId);
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

// ----- Client Dashboard -----
router.get('/client', requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.redirect('/portal/' + (req.session[PORTAL_USER_ROLE] === 'ADMIN' ? 'admin' : 'designer'));
  const [projects, user, referrals, notifications] = await Promise.all([
    portalDb.getProjectsForClient(req.session[PORTAL_USER_ID]),
    portalDb.getUserById(req.session[PORTAL_USER_ID]),
    portalDb.getLeadsByReferrerId(req.session[PORTAL_USER_ID]),
    portalDb.getNotificationsForUser(req.session[PORTAL_USER_ID]),
  ]);
  renderPortal(req, res, 'portal/client/dashboard', {
    projects,
    dvPoints: user?.dv_points_balance ?? 0,
    referrals: referrals || [],
    notifications: notifications || [],
    query: req.query,
  });
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

router.post('/client/projects/:id/design-version/:versionId/approve', requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const { version, design, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id || project.client_id !== req.session[PORTAL_USER_ID]) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  if (version && version.admin_status === 'APPROVED') await portalDb.updateDesignVersion(version.id, { client_status: 'APPROVED' });
  res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
});

router.post('/client/projects/:id/design-version/:versionId/deny', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id || project.client_id !== req.session[PORTAL_USER_ID]) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  const message = (req.body.reason || req.body.message || 'Denied by client').trim();
  if (version && version.admin_status === 'APPROVED') {
    await portalDb.updateDesignVersion(version.id, { client_status: 'DENIED' });
    if (message) await portalDb.addDesignComment(version.id, 'CLIENT', req.session[PORTAL_USER_ID], message);
  }
  res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
});

router.post('/client/projects/:id/design-version/:versionId/comment', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id || project.client_id !== req.session[PORTAL_USER_ID]) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  const message = (req.body.message || '').trim();
  if (version && version.admin_status === 'APPROVED' && message) await portalDb.addDesignComment(version.id, 'CLIENT', req.session[PORTAL_USER_ID], message);
  res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
});

router.get('/client/projects/:id', requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || project.client_id !== req.session[PORTAL_USER_ID]) return res.status(403).send('Forbidden');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  let extraCosts = [];
  if (quotation) extraCosts = await portalDb.getExtraCostsByQuotationId(quotation.id);
  const ecIds = extraCosts.map((e) => e.id);
  const allComments = ecIds.length ? await portalDb.getCommentsByExtraCostIds(ecIds) : [];
  const commentsByEc = {};
  allComments.forEach((c) => { if (!commentsByEc[c.extra_cost_id]) commentsByEc[c.extra_cost_id] = []; commentsByEc[c.extra_cost_id].push(c); });
  extraCosts.forEach((ec) => { ec.comments = commentsByEc[ec.id] || []; });
  const total = calculateProjectTotal(quotation, extraCosts);
  const media = await portalDb.getProjectMedia(project.id);
  const mediaList = media || [];
  const siteLog = mediaList.filter((m) => m.category === 'SITE_LOG');
  const byYearMonth = groupMediaByDate(siteLog);
  const mediaByCategory = {
    ARCHITECTURAL_PLANS: mediaList.filter((m) => m.category === 'ARCHITECTURAL_PLANS'),
    VISUALIZATIONS: mediaList.filter((m) => m.category === 'VISUALIZATIONS'),
    SITE_LOG: siteLog,
    OFFICIAL_DOCS: mediaList.filter((m) => m.category === 'OFFICIAL_DOCS'),
  };
  const vaultMediaList = buildVaultMediaList(mediaList);
  const dailyUpdates = await portalDb.getDailyUpdatesByProject(project.id);
  const projectDesigns = await portalDb.getDesignsForProjectWithDetails(project.id, { forClient: true });
  renderPortal(req, res, 'portal/client/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    media: mediaList,
    byYearMonth,
    mediaByCategory,
    vaultMediaList,
    dailyUpdates: dailyUpdates || [],
    projectDesigns,
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
  if (!isAdmin && isAssignedDesigner && project.designer_can_view_mirror === 0) return res.status(403).send('Forbidden');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  let extraCosts = [];
  if (quotation) extraCosts = await portalDb.getExtraCostsByQuotationId(quotation.id);
  const ecIds = extraCosts.map((e) => e.id);
  const allComments = ecIds.length ? await portalDb.getCommentsByExtraCostIds(ecIds) : [];
  const commentsByEc = {};
  allComments.forEach((c) => { if (!commentsByEc[c.extra_cost_id]) commentsByEc[c.extra_cost_id] = []; commentsByEc[c.extra_cost_id].push(c); });
  extraCosts.forEach((ec) => { ec.comments = commentsByEc[ec.id] || []; });
  const total = calculateProjectTotal(quotation, extraCosts);
  const media = await portalDb.getProjectMedia(project.id);
  const mediaList = media || [];
  const siteLog = mediaList.filter((m) => m.category === 'SITE_LOG');
  const byYearMonth = groupMediaByDate(siteLog);
  const mediaByCategory = {
    ARCHITECTURAL_PLANS: mediaList.filter((m) => m.category === 'ARCHITECTURAL_PLANS'),
    VISUALIZATIONS: mediaList.filter((m) => m.category === 'VISUALIZATIONS'),
    SITE_LOG: siteLog,
    OFFICIAL_DOCS: mediaList.filter((m) => m.category === 'OFFICIAL_DOCS'),
  };
  const vaultMediaList = buildVaultMediaList(mediaList);
  const dailyUpdates = await portalDb.getDailyUpdatesByProject(project.id);
  const projectDesigns = await portalDb.getDesignsForProjectWithDetails(project.id, { forClient: true });
  res.locals.mirrorBanner = true;
  renderPortal(req, res, 'portal/client/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    media: mediaList,
    byYearMonth,
    mediaByCategory,
    vaultMediaList,
    dailyUpdates: dailyUpdates || [],
    projectDesigns,
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

router.post('/api/extra-cost/:id/reject', express.json(), express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  const ec = await portalDb.getExtraCostById(req.params.id);
  if (!ec) return res.status(404).json({ error: 'Not found' });
  const q = await portalDb.getQuotationById(ec.quotation_id);
  const project = await portalDb.getProjectById(q.project_id);
  if (!project || project.client_id !== req.session[PORTAL_USER_ID]) return res.status(403).json({ error: 'Forbidden' });
  const reason = (req.body && (req.body.reason || req.body.rejection_reason)) ? String(req.body.reason || req.body.rejection_reason).trim() : '';
  if (!reason) return res.status(400).json({ error: 'Reason for rejection is required' });
  await portalDb.updateExtraCost(req.params.id, { status: 'REJECTED', client_note: reason });
  res.json({ ok: true });
});

router.post('/api/extra-cost/:id/comment', express.json(), express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  const ec = await portalDb.getExtraCostById(req.params.id);
  if (!ec) return res.status(404).json({ error: 'Not found' });
  const q = await portalDb.getQuotationById(ec.quotation_id);
  const project = await portalDb.getProjectById(q.project_id);
  if (!project || project.client_id !== req.session[PORTAL_USER_ID]) return res.status(403).json({ error: 'Forbidden' });
  const comment = req.body && req.body.comment != null ? String(req.body.comment).trim() : '';
  if (comment) await portalDb.addExtraCostComment(req.params.id, 'CLIENT', req.session[PORTAL_USER_ID], comment);
  const msg = 'Client commented on extra cost: ' + (ec.description || 'Variation').substring(0, 50) + (ec.description && ec.description.length > 50 ? '…' : '');
  if (project.designer_id) await portalDb.createNotification(project.designer_id, msg);
  const admins = await portalDb.getUsersByRole('ADMIN');
  for (const a of admins) { if (a.id) await portalDb.createNotification(a.id, msg); }
  res.json({ ok: true });
});

module.exports = router;
