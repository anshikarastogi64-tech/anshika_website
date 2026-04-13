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
const { sendWelcomeEmail, sendClientPaymentThankYouEmail } = require('../lib/portal-email');
const {
  LIFECYCLE_STAGES,
  enrichProjectLifecycle,
  lifecycleHeadline,
  deriveLegacyCurrentStageIndex,
  calculateProjectTotal,
  sumApprovedClientPayments,
  balanceDueAfterPublishedPayments,
  canMarkProjectCompletedByBalance,
  uuid,
  LEAD_STATUSES,
  groupMediaByDate,
  buildVaultMediaList,
  parsePaymentTermsJson,
  cloneDefaultPaymentTerms,
  sumPaymentTermsPercents,
  computePaymentMilestoneAllocations,
  fingerprintPaymentSchedule,
  buildPaymentScheduleNotifyMessage,
  buildPaymentScheduleShortLine,
} = require('../lib/portal');
const timelineUtil = require('../lib/portal-timeline');
const portalNotify = require('../lib/portal-notify');
const { CATEGORIES: NC } = portalNotify;
const portalMeet = require('../lib/portal-meet');
const multer = require('multer');
const fs = require('fs');

const portalUploadDir = path.join(__dirname, '..', 'Kelly', 'assets', 'uploads', 'portal');
if (!fs.existsSync(portalUploadDir)) fs.mkdirSync(portalUploadDir, { recursive: true });
const materialsUploadDir = path.join(portalUploadDir, 'materials');
if (!fs.existsSync(materialsUploadDir)) fs.mkdirSync(materialsUploadDir, { recursive: true });

function parseLifecycleIndicesFromBody(body, field) {
  let raw = body[`${field}[]`] !== undefined ? body[`${field}[]`] : body[field];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) raw = [raw];
  return [...new Set(raw.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n) && n >= 0 && n < LIFECYCLE_STAGES.length))].sort(
    (a, b) => a - b
  );
}

function buildLifecycleUpdates(body) {
  let completed = parseLifecycleIndicesFromBody(body, 'lifecycle_completed');
  let active = parseLifecycleIndicesFromBody(body, 'lifecycle_active');
  active = active.filter((i) => !completed.includes(i));
  return {
    lifecycle_completed_stages: JSON.stringify(completed),
    lifecycle_active_stages: JSON.stringify(active),
    current_stage: deriveLegacyCurrentStageIndex(completed, active),
  };
}

function buildPaymentTermsFromBody(body) {
  const intro = (body.payment_terms_intro || '').trim();
  const items = [];
  for (let i = 0; i < 10; i++) {
    const label = body[`pt_label_${i}`];
    if (!label || !String(label).trim()) continue;
    const pct = parseFloat(body[`pt_pct_${i}`]);
    if (Number.isNaN(pct)) continue;
    const dueRaw = body[`pt_due_${i}`];
    const dueDate =
      dueRaw && String(dueRaw).trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(dueRaw).trim())
        ? String(dueRaw).trim()
        : null;
    items.push({ label: String(label).trim(), percent: pct, basis: 'TOTAL', dueDate });
  }
  return { intro, items };
}

function buildPaymentScheduleViewForProject(project, quotation, extraCosts, clientPaymentsAll) {
  const paymentTerms = parsePaymentTermsJson(project.payment_terms_json);
  const qb =
    quotation && quotation.status === 'APPROVED' ? Number(quotation.base_total) || 0 : 0;
  const ct = calculateProjectTotal(quotation, extraCosts);
  const published = (clientPaymentsAll || []).filter((p) => Number(p.approved_for_client) === 1);
  return computePaymentMilestoneAllocations({
    items: paymentTerms.items,
    quotationBase: qb,
    contractTotal: ct,
    publishedPayments: published,
  });
}

async function assertDesignerTab(req, projectId, tabKey) {
  if (req.session[PORTAL_USER_ROLE] === 'ADMIN') return true;
  const access = await portalDb.getDesignerProjectPortalAccess(req.session[PORTAL_USER_ID], projectId);
  return !!(access && access.allowedTabs.has(tabKey));
}

function designerTabKeyForMediaCategory(category) {
  const c = String(category || '').toUpperCase();
  if (c === 'VASTU') return 'vastu';
  if (c === 'OTHER_DOCS') return 'other-docs';
  return 'vault';
}

async function getPaymentScheduleContext(projectId) {
  const project = await portalDb.getProjectById(projectId);
  if (!project) return null;
  const quotation = await portalDb.getLatestQuotationByProjectId(projectId);
  const extraCosts = quotation ? await portalDb.getExtraCostsByQuotationId(quotation.id) : [];
  const clientPaymentsAll = await portalDb.getClientPaymentsByProject(projectId);
  const result = buildPaymentScheduleViewForProject(project, quotation, extraCosts, clientPaymentsAll);
  const fp = fingerprintPaymentSchedule(result);
  return { project, quotation, extraCosts, clientPaymentsAll, result, fp };
}

async function maybeNotifyPaymentScheduleIfChanged(projectId, excludeUserIds) {
  const ctx = await getPaymentScheduleContext(projectId);
  if (!ctx) return;
  const prev = ctx.project.payment_schedule_notify_fingerprint || null;
  if (ctx.fp === prev) return;
  await portalDb.updateProject(projectId, { payment_schedule_notify_fingerprint: ctx.fp });
  const msg = buildPaymentScheduleNotifyMessage(ctx.project.title, ctx.result);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: msg,
      projectId,
      tabSuffix: '#tab-finance',
      excludeUserIds,
      includeClient: true,
    })
  );
}

function normalizeClientIdeaLink(raw) {
  const s = String(raw || '').trim().slice(0, 2000);
  if (!s) return '';
  const lower = s.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return 'https://' + s;
}

function clientIdeaUploadAllowed(file) {
  if (!file) return false;
  const mt = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
  const name = String(file.originalname || '').toLowerCase();
  if (mt.startsWith('image/')) return true;
  if (mt === 'application/pdf' || name.endsWith('.pdf')) return true;
  if (/\.(ppt|pptx|doc|docx|txt|rtf|key|pages|ai|eps)$/i.test(name)) return true;
  if (
    mt.includes('presentation') ||
    mt.includes('word') ||
    mt === 'text/plain' ||
    mt === 'application/rtf' ||
    mt === 'application/vnd.ms-powerpoint' ||
    mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return true;
  }
  return false;
}

function inferPortalUploadMediaType(file) {
  if (!file || !file.mimetype) return 'PHOTO';
  const rawMt = String(file.mimetype).toLowerCase();
  const mt = rawMt.split(';')[0].trim();
  const name = String(file.originalname || '').toLowerCase();
  if (mt.startsWith('video/')) return 'VIDEO';
  if (mt.startsWith('image/')) return 'PHOTO';
  if (mt === 'application/pdf' || name.endsWith('.pdf')) return 'DOCUMENT';
  const docExact = new Set([
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/rtf',
    'application/zip',
  ]);
  if (docExact.has(mt)) return 'DOCUMENT';
  if (/\.(ppt|pptx|doc|docx|xls|xlsx|txt|zip|rar|7z|key|pages|numbers|ai|eps|sketch|fig|csv)$/i.test(name)) return 'DOCUMENT';
  return 'PHOTO';
}

const portalUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, portalUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'file').replace(/\s/g, '-')),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const moodBoardUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, portalUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'file').replace(/\s/g, '-')),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const ideaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, portalUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'file').replace(/\s/g, '-')),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const materialsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, materialsUploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'img').replace(/\s/g, '-')),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function unlinkPortalMaterialFile(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return;
  const prefix = '/assets/uploads/portal/materials/';
  if (!imageUrl.startsWith(prefix)) return;
  const fp = path.join(materialsUploadDir, path.basename(imageUrl));
  fs.unlink(fp, () => {});
}

async function renderPortal(req, res, view, data = {}) {
  const merged = { ...res.locals, ...data, timelineUtil };
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

async function requireClientProjectAccess(req, projectId, needTab) {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return null;
  const access = await portalDb.getClientProjectPortalAccess(req.session[PORTAL_USER_ID], projectId);
  if (!access) return null;
  if (needTab && !access.allowedTabs.has(needTab)) return null;
  return access;
}

function clientTabVisibilityMap(allowedTabsSet) {
  const m = {};
  for (const k of portalDb.CLIENT_PORTAL_TAB_KEYS) {
    m[k] = allowedTabsSet.has(k);
  }
  return m;
}

function enrichProjectMeetingsList(rows) {
  return (rows || []).map((m) => ({
    ...m,
    google_calendar_url: portalMeet.buildGoogleCalendarTemplateUrl({
      title: m.title,
      startIso: m.start_at,
      endIso: m.end_at,
      details: m.notes || '',
    }),
  }));
}

function groupPortalProjectMessages(rows) {
  const byThread = {};
  (rows || []).forEach((r) => {
    if (!byThread[r.thread_id]) byThread[r.thread_id] = [];
    byThread[r.thread_id].push(r);
  });
  return Object.keys(byThread)
    .map((tid) => {
      const msgs = byThread[tid].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const root = msgs.find((m) => !m.parent_id) || msgs[0];
      const last = msgs[msgs.length - 1];
      return { threadId: tid, messages: msgs, root, lastAt: last.created_at };
    })
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

function allClientTabsVisibleMap() {
  const m = {};
  for (const k of portalDb.CLIENT_PORTAL_TAB_KEYS) {
    m[k] = true;
  }
  return m;
}

function parseWorksiteCoordBody(val) {
  const s = String(val ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeWorksiteBody(body) {
  const site_address = String(body.site_address || '').trim().slice(0, 2000);
  const site_map_place_label = String(body.site_map_place_label || '').trim().slice(0, 500);
  const site_contact_name = String(body.site_contact_name || '').trim().slice(0, 200);
  const site_contact_phone = String(body.site_contact_phone || '').trim().slice(0, 80);
  let site_map_lat = parseWorksiteCoordBody(body.site_map_lat);
  let site_map_lng = parseWorksiteCoordBody(body.site_map_lng);
  if (site_map_lat != null && (site_map_lat < -90 || site_map_lat > 90)) site_map_lat = null;
  if (site_map_lng != null && (site_map_lng < -180 || site_map_lng > 180)) site_map_lng = null;
  return {
    site_address: site_address || null,
    site_map_place_label: site_map_place_label || null,
    site_contact_name: site_contact_name || null,
    site_contact_phone: site_contact_phone || null,
    site_map_lat,
    site_map_lng,
  };
}

async function resolveProjectWorksiteAccess(req, projectId) {
  const role = req.session[PORTAL_USER_ROLE];
  const userId = req.session[PORTAL_USER_ID];
  const projectRow = await portalDb.getProjectById(projectId);
  if (!projectRow) return null;
  if (role === 'ADMIN') {
    return { backUrl: '/portal/admin/projects/' + projectId, savePath: '/portal/admin/projects/' + projectId + '/worksite' };
  }
  if (role === 'DESIGNER') {
    if (!(await portalDb.designerHasProjectAccess(userId, projectId))) return null;
    return { backUrl: '/portal/designer/projects/' + projectId, savePath: '/portal/designer/projects/' + projectId + '/worksite' };
  }
  if (role === 'CLIENT') {
    const acc = await portalDb.getClientProjectPortalAccess(userId, projectId);
    if (!acc) return null;
    return { backUrl: '/portal/client/projects/' + projectId, savePath: '/portal/client/projects/' + projectId + '/worksite' };
  }
  return null;
}

async function renderWorksitePage(req, res, ctx) {
  const project = await portalDb.getProjectWithRelations(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  enrichProjectLifecycle(project);
  renderPortal(req, res, 'portal/project_worksite', {
    title: 'Site location & contact',
    project,
    worksiteBackUrl: ctx.backUrl,
    worksiteSavePath: ctx.savePath,
    query: req.query,
    googleMapsJsApiKey: (process.env.GOOGLE_MAPS_JS_API_KEY || '').trim(),
  });
}

async function handleWorksitePost(req, res, ctx) {
  const projectId = req.params.id;
  const patch = normalizeWorksiteBody(req.body);
  await portalDb.updateProject(projectId, patch);
  const p = await portalDb.getProjectById(projectId);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.PROJECT,
      message: `Site location or contact was updated for «${p?.title || 'Project'}».`,
      projectId,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(ctx.savePath + '?msg=' + encodeURIComponent('Saved site location and contact.'));
}

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
  const emailNorm = String(email).trim().toLowerCase();
  try {
    const user = await portalDb.getUserByEmail(emailNorm);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.render('portal/login', { error: 'Invalid email or password.' });
    }
    req.session[PORTAL_USER_ID] = user.id;
    req.session[PORTAL_USER_EMAIL] = user.email;
    req.session[PORTAL_USER_ROLE] = user.role;
    req.session[PORTAL_USER_NAME] = user.full_name;
    // Express 5: redirect before session is written can omit Set-Cookie; save first.
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('portal login session save:', saveErr);
        return res.render('portal/login', { error: 'Login failed. Try again.' });
      }
      if (user.role === 'ADMIN') return res.redirect('/portal/admin');
      if (user.role === 'DESIGNER') return res.redirect('/portal/designer');
      return res.redirect('/portal/client');
    });
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

// ----- Portal layout locals (unread notification count for bell) -----
router.use(requirePortalAuth, async (req, res, next) => {
  res.locals.portalUser = {
    id: req.session[PORTAL_USER_ID],
    email: req.session[PORTAL_USER_EMAIL],
    role: req.session[PORTAL_USER_ROLE],
    name: req.session[PORTAL_USER_NAME],
  };
  res.locals.LIFECYCLE_STAGES = LIFECYCLE_STAGES;
  res.locals.lifecycleHeadline = lifecycleHeadline;
  try {
    res.locals.portalUnreadCount = await portalDb.countUnreadNotifications(req.session[PORTAL_USER_ID]);
  } catch (e) {
    res.locals.portalUnreadCount = 0;
  }
  next();
});

// ----- Notifications (all roles) -----
router.get('/notifications', requirePortalAuth, async (req, res) => {
  const list = await portalDb.getNotificationsForUser(req.session[PORTAL_USER_ID], 100);
  renderPortal(req, res, 'portal/notifications', { notifications: list || [], query: req.query });
});

router.get('/notifications/go/:id', requirePortalAuth, async (req, res) => {
  const n = await portalDb.getPortalNotificationForUser(req.params.id, req.session[PORTAL_USER_ID]);
  if (!n) return res.redirect('/portal/notifications');
  await portalDb.markNotificationRead(req.params.id, req.session[PORTAL_USER_ID]);
  let dest = (n.link_url && String(n.link_url).trim()) || '/portal/notifications';
  if (!dest.startsWith('/') || dest.startsWith('//')) dest = '/portal/notifications';
  res.redirect(dest);
});

router.post('/notifications/:id/read', requirePortalAuth, async (req, res) => {
  await portalDb.markNotificationRead(req.params.id, req.session[PORTAL_USER_ID]);
  res.redirect('/portal/notifications');
});

router.post('/notifications/read-all', requirePortalAuth, async (req, res) => {
  await portalDb.markAllNotificationsRead(req.session[PORTAL_USER_ID]);
  res.redirect('/portal/notifications');
});

// ----- Admin: notification routing settings -----
router.get('/admin/notification-settings', requirePortalAuth, requireAdmin, async (req, res) => {
  const routing = await portalDb.getAllNotificationRouting();
  renderPortal(req, res, 'portal/admin/notification_settings', {
    routing: routing || [],
    query: req.query,
  });
});

router.post('/admin/notification-settings', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const body = req.body || {};
  const rows = await portalDb.getAllNotificationRouting();
  for (const row of rows || []) {
    const cat = row.category;
    const c = body[`client_${cat}`] === '1' ? 1 : 0;
    const a = body[`admin_${cat}`] === '1' ? 1 : 0;
    const d = body[`designer_${cat}`] === '1' ? 1 : 0;
    await portalDb.updateNotificationRouting(cat, c, a, d);
  }
  res.redirect('/portal/admin/notification-settings?msg=Saved');
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

router.get('/admin/users/:id/password', requirePortalAuth, requireAdmin, async (req, res) => {
  const user = await portalDb.getUserById(req.params.id);
  if (!user) return res.status(404).send('User not found');
  renderPortal(req, res, 'portal/admin/user_password', { user, query: req.query });
});

router.post('/admin/users/:id/password', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const user = await portalDb.getUserById(req.params.id);
  if (!user) return res.status(404).send('User not found');
  const pwd = (req.body.password || '').trim();
  const confirm = (req.body.password_confirm || '').trim();
  if (!pwd || pwd.length < 6 || pwd !== confirm) {
    return res.redirect('/portal/admin/users/' + req.params.id + '/password?error=Invalid+password');
  }
  const hash = bcrypt.hashSync(pwd, 10);
  await portalDb.run('UPDATE portal_users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  res.redirect('/portal/admin/users?msg=Password+updated');
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
  const lead = await portalDb.getLeadById(req.params.id);
  if (lead) {
    portalNotify.safeNotify(
      portalNotify.notifyLeadStakeholders(portalDb, {
        category: NC.LEAD,
        message: `Lead assignment updated for «${lead.name}».`,
        leadId: req.params.id,
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
  res.redirect('/portal/admin/leads/' + req.params.id);
});

router.post('/admin/leads/:id/note', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const note = (req.body.note || '').trim();
  if (note) {
    await portalDb.addLeadActivity(req.params.id, note);
    const lead = await portalDb.getLeadById(req.params.id);
    if (lead) {
      portalNotify.safeNotify(
        portalNotify.notifyLeadStakeholders(portalDb, {
          category: NC.LEAD,
          message: `New admin note on lead «${lead.name}».`,
          leadId: req.params.id,
          excludeUserIds: [req.session[PORTAL_USER_ID]],
        })
      );
    }
  }
  res.redirect('/portal/admin/leads/' + req.params.id);
});

// ----- Admin: Projects (static /new before /:id) -----
router.get('/admin/projects', requirePortalAuth, requireAdmin, async (req, res) => {
  const projects = await portalDb.getProjectsForAdmin();
  (projects || []).forEach((p) => enrichProjectLifecycle(p));
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
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.PROJECT,
      message: `New project «${title.trim()}» is available in your portal.`,
      projectId,
      tabSuffix: '#tab-updates',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/admin/projects/' + projectId);
});

router.get('/admin/projects/:id', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectWithRelations(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  enrichProjectLifecycle(project);
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
  const warrantyDocs = mediaList.filter((m) => m.category === 'WARRANTY_GUARANTEE');
  const vastuDocs = mediaList.filter((m) => m.category === 'VASTU');
  const otherDocs = mediaList.filter((m) => m.category === 'OTHER_DOCS');
  const moodBoardFiles = mediaList.filter((m) => m.category === 'MOOD_BOARD');
  const [projectDesigns, pendingDesignVersions, dailyUpdates, timelineExtensions, clientPayments, projectMembers, allPortalClients, materialSelections, designsForMaterialLink, projectDesigners] =
    await Promise.all([
    portalDb.getDesignsForProjectWithDetails(project.id, { forClient: false }),
    portalDb.getPendingDesignVersionsForProject(project.id),
    portalDb.getDailyUpdatesByProject(project.id),
    portalDb.getTimelineExtensions(project.id),
    portalDb.getClientPaymentsByProject(project.id),
    portalDb.getProjectMembersWithUsers(project.id),
    portalDb.getUsersByRole('CLIENT'),
    portalDb.getMaterialSelectionsForProject(project.id),
    portalDb.getDesignsForProjectWithDetails(project.id, { forClient: true }),
    portalDb.getProjectDesignersWithUsers(project.id),
  ]);
  const memberIdSet = new Set((projectMembers || []).map((m) => m.user_id));
  const portalClientsAvailable = (allPortalClients || []).filter((c) => !memberIdSet.has(c.id));
  const designerAssignedIdSet = new Set((projectDesigners || []).map((d) => d.user_id));
  const portalDesignersAvailable = (designers || []).filter((d) => !designerAssignedIdSet.has(d.id));
  const financePaidPublished = sumApprovedClientPayments(clientPayments);
  const financePaidPending = (clientPayments || []).filter((p) => Number(p.approved_for_client) !== 1).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const financeBalanceDue = balanceDueAfterPublishedPayments(total, clientPayments);
  const canMarkProjectCompleted = canMarkProjectCompletedByBalance(total, clientPayments);
  const paymentTerms = parsePaymentTermsJson(project.payment_terms_json);
  const quotationBaseForTerms =
    quotation && quotation.status === 'APPROVED' ? Number(quotation.base_total) || 0 : 0;
  const paymentScheduleProgress = buildPaymentScheduleViewForProject(project, quotation, extraCosts, clientPayments || []);
  const projectMessagesRaw = await portalDb.getProjectMessages(project.id);
  const projectMessageThreads = groupPortalProjectMessages(projectMessagesRaw);
  const projectMeetings = enrichProjectMeetingsList(await portalDb.getProjectMeetings(project.id));
  const [designIdeaAreas, designIdeasWithComments] = await Promise.all([
    portalDb.listDesignIdeaAreasForProject(project.id),
    portalDb.listDesignIdeasWithCommentsForProject(project.id),
  ]);
  renderPortal(req, res, 'portal/admin/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    financePaidPublished,
    financePaidPending,
    financeBalanceDue,
    canMarkProjectCompleted,
    clientPayments: clientPayments || [],
    query: req.query,
    designers,
    media: mediaList,
    mediaByCategory,
    byYearMonth,
    vaultMediaList,
    projectDesigns,
    pendingDesignVersions,
    dailyUpdates: dailyUpdates || [],
    warrantyDocs,
    vastuDocs,
    otherDocs,
    moodBoardFiles,
    timelineExtensions: timelineExtensions || [],
    isMirror: false,
    paymentTerms,
    quotationBaseForTerms,
    paymentScheduleProgress,
    projectMembers: projectMembers || [],
    portalClientsAvailable: portalClientsAvailable || [],
    clientPortalTabKeys: portalDb.CLIENT_PORTAL_TAB_KEYS,
    projectDesigners: projectDesigners || [],
    portalDesignersAvailable: portalDesignersAvailable || [],
    designerPortalTabKeys: portalDb.DESIGNER_PORTAL_TAB_KEYS,
    materialSelections: materialSelections || [],
    designsForMaterialLink: designsForMaterialLink || [],
    projectMessageThreads,
    messagePriorities: portalDb.MESSAGE_PRIORITY_LEVELS,
    projectMeetings,
    designIdeaAreas: designIdeaAreas || [],
    designIdeasWithComments: designIdeasWithComments || [],
  });
});

router.get('/admin/projects/:id/worksite', requirePortalAuth, requireAdmin, async (req, res) => {
  const ctx = await resolveProjectWorksiteAccess(req, req.params.id);
  if (!ctx) return res.status(404).send('Project not found');
  return renderWorksitePage(req, res, ctx);
});

router.post(
  '/admin/projects/:id/worksite',
  express.urlencoded({ extended: true }),
  requirePortalAuth,
  requireAdmin,
  async (req, res) => {
    const ctx = await resolveProjectWorksiteAccess(req, req.params.id);
    if (!ctx) return res.status(404).send('Project not found');
    return handleWorksitePost(req, res, ctx);
  }
);

router.post('/admin/projects/:id/assign', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const designer_id = (req.body.designer_id || '').trim() || null;
  if (!designer_id) return res.redirect('/portal/admin/projects/' + req.params.id);
  await portalDb.setProjectPrimaryDesignerAndSyncJunction(req.params.id, designer_id);
  const p = await portalDb.getProjectById(req.params.id);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.PROJECT,
      message: `Designer assignment was updated for «${p?.title || 'Project'}».`,
      projectId: req.params.id,
      tabSuffix: '#tab-updates',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/admin/projects/' + req.params.id);
});

router.post('/admin/projects/:id/designer-mirror-visibility', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const designer_can_view_mirror = req.body.designer_can_view_mirror === '1' ? 1 : 0;
  await portalDb.updateProject(req.params.id, { designer_can_view_mirror });
  res.redirect('/portal/admin/projects/' + req.params.id);
});

/** Must match `views/portal/admin/project_detail.ejs` checkbox `name` (tab_ / dtab_ + key with hyphens → underscores). */
function portalMemberTabBodyField(tabKey) {
  return 'tab_' + String(tabKey).replace(/-/g, '_');
}
function portalDesignerTabBodyField(tabKey) {
  return 'dtab_' + String(tabKey).replace(/-/g, '_');
}
/** Global `express.urlencoded({ extended: false })` can yield string values; duplicate keys become arrays — treat all as checked/on. */
function bodyCheckboxChecked(body, fieldName) {
  const v = body[fieldName];
  if (v === undefined || v === null) return false;
  if (v === true || v === 1 || v === '1') return true;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === 'on' || t === 'true') return true;
  }
  if (Array.isArray(v)) {
    return v.some((x) => x === true || x === 1 || x === '1' || (typeof x === 'string' && ['on', 'true', '1'].includes(String(x).trim().toLowerCase())));
  }
  return false;
}

router.post('/admin/projects/:id/members/add', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const userId = (req.body.user_id || '').trim();
  if (!userId) return res.redirect('/portal/admin/projects/' + projectId + '?msg=Select+a+user#tab-updates');
  try {
    await portalDb.addProjectMember(projectId, userId);
  } catch (e) {
    const msg = e && e.code === 'INVALID_MEMBER_ROLE' ? e.message : 'Could not add user.';
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=' + encodeURIComponent(msg) + '#tab-updates');
  }
  res.redirect('/portal/admin/projects/' + projectId + '#tab-updates');
});

router.post('/admin/projects/:id/members/remove', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const userId = (req.body.user_id || '').trim();
  const r = await portalDb.removeProjectMember(projectId, userId);
  const q =
    r.ok ? '' : r.reason === 'primary_client' ? '?msg=' + encodeURIComponent('Cannot remove the primary client. Add another primary first or re-create the project.') : '';
  res.redirect('/portal/admin/projects/' + projectId + q + '#tab-updates');
});

router.post('/admin/projects/:id/members/tabs', requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const userId = (req.body.user_id || '').trim();
  if (!userId) return res.redirect('/portal/admin/projects/' + projectId + '#tab-updates');
  const selected = portalDb.CLIENT_PORTAL_TAB_KEYS.filter((k) => bodyCheckboxChecked(req.body, portalMemberTabBodyField(k)));
  await portalDb.updateProjectMemberTabs(projectId, userId, selected);
  res.redirect('/portal/admin/projects/' + projectId + '#tab-updates');
});

router.post('/admin/projects/:id/designers/add', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const userId = (req.body.user_id || '').trim();
  if (!userId) return res.redirect('/portal/admin/projects/' + projectId + '?msg=Select+a+designer#tab-updates');
  try {
    await portalDb.addProjectDesigner(projectId, userId);
  } catch (e) {
    const msg = e && e.code ? e.message : 'Could not add designer.';
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=' + encodeURIComponent(msg) + '#tab-updates');
  }
  res.redirect('/portal/admin/projects/' + projectId + '#tab-updates');
});

router.post('/admin/projects/:id/designers/remove', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const userId = (req.body.user_id || '').trim();
  const r = await portalDb.removeProjectDesigner(projectId, userId);
  const q =
    r.ok ? '' : r.reason === 'primary_designer' ? '?msg=' + encodeURIComponent('Cannot remove the primary designer. Assign a different primary first.') : '';
  res.redirect('/portal/admin/projects/' + projectId + q + '#tab-updates');
});

router.post('/admin/projects/:id/designers/tabs', requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const userId = (req.body.user_id || '').trim();
  if (!userId) return res.redirect('/portal/admin/projects/' + projectId + '#tab-updates');
  const selected = portalDb.DESIGNER_PORTAL_TAB_KEYS.filter((k) => bodyCheckboxChecked(req.body, portalDesignerTabBodyField(k)));
  await portalDb.updateProjectDesignerTabs(projectId, userId, selected);
  res.redirect('/portal/admin/projects/' + projectId + '#tab-updates');
});

router.post('/admin/projects/:id/payment-terms', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const redir = '/portal/admin/projects/' + req.params.id + '#tab-finance';
  if (req.body.reset_payment_terms === '1') {
    await portalDb.updateProject(req.params.id, { payment_terms_json: null });
  } else {
    const built = buildPaymentTermsFromBody(req.body);
    if (!built.items.length) {
      const def = cloneDefaultPaymentTerms();
      def.intro = built.intro;
      await portalDb.updateProject(req.params.id, { payment_terms_json: JSON.stringify(def) });
    } else {
      const sumPct = sumPaymentTermsPercents(built.items);
      if (Math.abs(sumPct - 100) > 0.02) {
        return res.redirect(
          `${redir}?msg=${encodeURIComponent(`Milestone percentages must total exactly 100%. Current sum: ${sumPct.toFixed(2)}%`)}`
        );
      }
      await portalDb.updateProject(req.params.id, { payment_terms_json: JSON.stringify(built) });
    }
  }
  const p = await portalDb.getProjectById(req.params.id);
  if (p) {
    const quotation = await portalDb.getLatestQuotationByProjectId(p.id);
    const extraCosts = quotation ? await portalDb.getExtraCostsByQuotationId(quotation.id) : [];
    const clientPaymentsAll = await portalDb.getClientPaymentsByProject(p.id);
    const result = buildPaymentScheduleViewForProject(p, quotation, extraCosts, clientPaymentsAll);
    const fp = fingerprintPaymentSchedule(result);
    await portalDb.updateProject(p.id, { payment_schedule_notify_fingerprint: fp });
    const short = buildPaymentScheduleShortLine(result);
    const headline =
      req.body.reset_payment_terms === '1'
        ? `Payment terms for «${p.title}» were reset to the studio default. ${short}`
        : `Payment terms for «${p.title}» were saved. ${short}`;
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.FINANCE,
        message: headline,
        projectId: p.id,
        tabSuffix: '#tab-finance',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: true,
      })
    );
  }
  res.redirect(redir);
});

router.post('/admin/projects/:id/update', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const updates = {};
  if (req.body.lifecycle_update === '1') {
    Object.assign(updates, buildLifecycleUpdates(req.body));
  }
  if (req.body.title !== undefined) {
    const t = String(req.body.title).trim();
    if (t && t !== project.title) updates.title = t;
  }
  if (Object.keys(updates).length === 0) {
    return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-updates');
  }
  await portalDb.updateProject(req.params.id, updates);
  const p = await portalDb.getProjectById(req.params.id);
  if (p) {
    const hadLifecycle = req.body.lifecycle_update === '1';
    const hadTitle = updates.title !== undefined;
    let message = `Project details were updated on «${p.title}».`;
    if (hadLifecycle && hadTitle) message = `Project lifecycle and name were updated on «${p.title}».`;
    else if (hadLifecycle) message = `Project lifecycle stages were updated on «${p.title}».`;
    else if (hadTitle) message = `Project name was updated to «${p.title}».`;
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.PROJECT,
        message,
        projectId: p.id,
        tabSuffix: '#tab-updates',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: hadLifecycle || hadTitle,
      })
    );
  }
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-updates');
});

const DEFAULT_DESIGN_TIMELINE_DAYS = 15;
const DEFAULT_EXECUTION_TIMELINE_DAYS = 45;

function redirectTimeline(req, res, projectId, isAdmin, query) {
  const base = isAdmin ? '/portal/admin/projects/' : '/portal/designer/projects/';
  const q = query ? '?' + query : '';
  res.redirect(base + projectId + q + '#tab-timelines');
}

// ----- Project timelines (design & execution) -----
router.post('/admin/projects/:id/timeline/design/init', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  if (project.design_timeline_start) return redirectTimeline(req, res, projectId, true, 'msg=Design+timeline+already+exists+use+update');
  const start = (req.body.start_date || '').trim();
  if (!timelineUtil.isValidISODate(start)) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+start+date');
  const dur = Math.max(1, parseInt(req.body.duration_days, 10) || DEFAULT_DESIGN_TIMELINE_DAYS);
  const end = timelineUtil.endDateFromStartAndDuration(start, dur);
  await portalDb.updateProject(projectId, { design_timeline_start: start, design_timeline_end: end, design_timeline_duration_days: dur });
  redirectTimeline(req, res, projectId, true, '');
});

router.post('/admin/projects/:id/timeline/design/update', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const start = (req.body.start_date || '').trim();
  if (!timelineUtil.isValidISODate(start)) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+start+date');
  let end = (req.body.end_date || '').trim();
  let dur = parseInt(req.body.duration_days, 10);
  if (timelineUtil.isValidISODate(end)) {
    if (timelineUtil.compareISODates(end, start) < 0) return redirectTimeline(req, res, projectId, true, 'msg=End+date+before+start');
    dur = timelineUtil.inclusiveDayCount(start, end);
    if (!dur) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+date+range');
  } else if (dur >= 1) {
    end = timelineUtil.endDateFromStartAndDuration(start, dur);
  } else {
    dur = Math.max(1, parseInt(project.design_timeline_duration_days, 10) || DEFAULT_DESIGN_TIMELINE_DAYS);
    end = timelineUtil.endDateFromStartAndDuration(start, dur);
  }
  await portalDb.updateProject(projectId, { design_timeline_start: start, design_timeline_end: end, design_timeline_duration_days: dur });
  redirectTimeline(req, res, projectId, true, '');
});

router.post('/admin/projects/:id/timeline/execution/init', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  if (project.execution_timeline_start) return redirectTimeline(req, res, projectId, true, 'msg=Execution+timeline+already+exists');
  const start = (req.body.start_date || '').trim();
  if (!timelineUtil.isValidISODate(start)) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+start+date');
  const dur = Math.max(1, parseInt(req.body.duration_days, 10) || DEFAULT_EXECUTION_TIMELINE_DAYS);
  const end = timelineUtil.endDateFromStartAndDuration(start, dur);
  await portalDb.updateProject(projectId, { execution_timeline_start: start, execution_timeline_end: end, execution_timeline_duration_days: dur });
  redirectTimeline(req, res, projectId, true, '');
});

router.post('/admin/projects/:id/timeline/execution/update', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const start = (req.body.start_date || '').trim();
  if (!timelineUtil.isValidISODate(start)) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+start+date');
  let end = (req.body.end_date || '').trim();
  let dur = parseInt(req.body.duration_days, 10);
  if (timelineUtil.isValidISODate(end)) {
    if (timelineUtil.compareISODates(end, start) < 0) return redirectTimeline(req, res, projectId, true, 'msg=End+date+before+start');
    dur = timelineUtil.inclusiveDayCount(start, end);
    if (!dur) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+date+range');
  } else if (dur >= 1) {
    end = timelineUtil.endDateFromStartAndDuration(start, dur);
  } else {
    dur = Math.max(1, parseInt(project.execution_timeline_duration_days, 10) || DEFAULT_EXECUTION_TIMELINE_DAYS);
    end = timelineUtil.endDateFromStartAndDuration(start, dur);
  }
  await portalDb.updateProject(projectId, { execution_timeline_start: start, execution_timeline_end: end, execution_timeline_duration_days: dur });
  redirectTimeline(req, res, projectId, true, '');
});

router.post('/admin/projects/:id/timeline/design/publish-client', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || !project.design_timeline_start) return redirectTimeline(req, res, req.params.id, true, 'msg=Set+design+dates+first');
  await portalDb.updateProject(req.params.id, { design_timeline_visible_to_client: 1 });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `Design schedule for «${project.title}» is now visible in your portal.`,
      projectId: project.id,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  redirectTimeline(req, res, req.params.id, true, '');
});

router.post('/admin/projects/:id/timeline/design/unpublish-client', requirePortalAuth, requireAdmin, async (req, res) => {
  await portalDb.updateProject(req.params.id, { design_timeline_visible_to_client: 0 });
  redirectTimeline(req, res, req.params.id, true, '');
});

router.post('/admin/projects/:id/timeline/execution/publish-client', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || !project.execution_timeline_start) return redirectTimeline(req, res, req.params.id, true, 'msg=Set+execution+dates+first');
  await portalDb.updateProject(req.params.id, { execution_timeline_visible_to_client: 1 });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `Execution schedule for «${project.title}» is now visible in your portal.`,
      projectId: project.id,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  redirectTimeline(req, res, req.params.id, true, '');
});

router.post('/admin/projects/:id/timeline/execution/unpublish-client', requirePortalAuth, requireAdmin, async (req, res) => {
  await portalDb.updateProject(req.params.id, { execution_timeline_visible_to_client: 0 });
  redirectTimeline(req, res, req.params.id, true, '');
});

router.post('/admin/projects/:id/timeline/extension', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const phase = (req.body.phase || '').toUpperCase();
  if (phase !== 'DESIGN' && phase !== 'EXECUTION') return redirectTimeline(req, res, projectId, true, 'msg=Invalid+phase');
  const extra = parseInt(req.body.extra_days, 10);
  const reason = (req.body.reason || '').trim();
  if (!reason || !Number.isFinite(extra) || extra < 1 || extra > 999) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+extension');
  const curEnd = phase === 'DESIGN' ? project.design_timeline_end : project.execution_timeline_end;
  if (!curEnd) return redirectTimeline(req, res, projectId, true, 'msg=Complete+timeline+for+that+phase+first');
  await portalDb.createTimelineExtension(projectId, phase, extra, reason, req.session[PORTAL_USER_ID], 'ADMIN');
  const p = await portalDb.getProjectById(projectId);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `A ${phase === 'DESIGN' ? 'design' : 'execution'} timeline extension (+${extra}d) was recorded for «${p?.title || 'Project'}».`,
      projectId,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  redirectTimeline(req, res, projectId, true, '');
});

router.post('/admin/projects/:id/timeline/extension/:extId/approve', requirePortalAuth, requireAdmin, async (req, res) => {
  const ext = await portalDb.getTimelineExtensionById(req.params.extId);
  if (!ext || ext.project_id !== req.params.id) return redirectTimeline(req, res, req.params.id, true, 'msg=Not+found');
  const project = await portalDb.getProjectById(ext.project_id);
  const curEnd = ext.phase === 'DESIGN' ? project.design_timeline_end : project.execution_timeline_end;
  if (!curEnd) return redirectTimeline(req, res, req.params.id, true, 'msg=Missing+end+date');
  const ok = await portalDb.approveTimelineExtension(ext.id, req.session[PORTAL_USER_ID]);
  if (!ok) return redirectTimeline(req, res, req.params.id, true, 'msg=Could+not+approve');
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `A timeline extension was approved for «${project.title}» (${ext.phase}).`,
      projectId: project.id,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  redirectTimeline(req, res, req.params.id, true, '');
});

router.post('/admin/projects/:id/timeline/extension/:extId/reject', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const ext = await portalDb.getTimelineExtensionById(req.params.extId);
  if (!ext || ext.project_id !== req.params.id) return redirectTimeline(req, res, req.params.id, true, 'msg=Not+found');
  const note = (req.body.review_note || '').trim() || null;
  await portalDb.rejectTimelineExtension(ext.id, req.session[PORTAL_USER_ID], note);
  const project = await portalDb.getProjectById(ext.project_id);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `A timeline extension request was declined for «${project?.title || 'Project'}».`,
      projectId: ext.project_id,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  redirectTimeline(req, res, req.params.id, true, '');
});

router.post('/admin/projects/:id/timeline/design/complete', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  if (!project.design_timeline_start) return redirectTimeline(req, res, projectId, true, 'msg=Set+design+schedule+first');
  if (project.design_timeline_completed_date) return redirectTimeline(req, res, projectId, true, 'msg=Design+phase+already+marked+complete');
  let d = (req.body.completion_date || '').trim();
  if (!d) d = timelineUtil.todayLocalISO();
  if (!timelineUtil.isValidISODate(d)) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+completion+date');
  await portalDb.updateProject(projectId, { design_timeline_completed_date: d });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `Design phase was marked complete for «${project.title}».`,
      projectId,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  redirectTimeline(req, res, projectId, true, '');
});

router.post('/admin/projects/:id/timeline/design/clear-complete', requirePortalAuth, requireAdmin, async (req, res) => {
  await portalDb.updateProject(req.params.id, { design_timeline_completed_date: null });
  redirectTimeline(req, res, req.params.id, true, '');
});

router.post('/admin/projects/:id/timeline/execution/complete', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  if (!project.execution_timeline_start) return redirectTimeline(req, res, projectId, true, 'msg=Set+execution+schedule+first');
  if (project.execution_timeline_completed_date) return redirectTimeline(req, res, projectId, true, 'msg=Execution+phase+already+marked+complete');
  let d = (req.body.completion_date || '').trim();
  if (!d) d = timelineUtil.todayLocalISO();
  if (!timelineUtil.isValidISODate(d)) return redirectTimeline(req, res, projectId, true, 'msg=Invalid+completion+date');
  await portalDb.updateProject(projectId, { execution_timeline_completed_date: d });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `Execution phase was marked complete for «${project.title}».`,
      projectId,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  redirectTimeline(req, res, projectId, true, '');
});

router.post('/admin/projects/:id/timeline/execution/clear-complete', requirePortalAuth, requireAdmin, async (req, res) => {
  await portalDb.updateProject(req.params.id, { execution_timeline_completed_date: null });
  redirectTimeline(req, res, req.params.id, true, '');
});

router.post('/designer/projects/:id/timeline/design/complete', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, projectId, 'timelines'))) return res.status(403).send('Forbidden');
  if (!project.design_timeline_start) return redirectTimeline(req, res, projectId, false, 'msg=Set+design+schedule+first');
  if (project.design_timeline_completed_date) return redirectTimeline(req, res, projectId, false, 'msg=Design+phase+already+marked+complete');
  let d = (req.body.completion_date || '').trim();
  if (!d) d = timelineUtil.todayLocalISO();
  if (!timelineUtil.isValidISODate(d)) return redirectTimeline(req, res, projectId, false, 'msg=Invalid+completion+date');
  await portalDb.updateProject(projectId, { design_timeline_completed_date: d });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `Design phase was marked complete for «${project.title}».`,
      projectId,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  redirectTimeline(req, res, projectId, false, '');
});

router.post('/designer/projects/:id/timeline/execution/complete', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, projectId, 'timelines'))) return res.status(403).send('Forbidden');
  if (!project.execution_timeline_start) return redirectTimeline(req, res, projectId, false, 'msg=Set+execution+schedule+first');
  if (project.execution_timeline_completed_date) return redirectTimeline(req, res, projectId, false, 'msg=Execution+phase+already+marked+complete');
  let d = (req.body.completion_date || '').trim();
  if (!d) d = timelineUtil.todayLocalISO();
  if (!timelineUtil.isValidISODate(d)) return redirectTimeline(req, res, projectId, false, 'msg=Invalid+completion+date');
  await portalDb.updateProject(projectId, { execution_timeline_completed_date: d });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `Execution phase was marked complete for «${project.title}».`,
      projectId,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  redirectTimeline(req, res, projectId, false, '');
});

router.post('/designer/projects/:id/timeline/design/init', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, projectId, 'timelines'))) return res.status(403).send('Forbidden');
  if (project.design_timeline_start) return redirectTimeline(req, res, projectId, false, 'msg=Design+timeline+already+set');
  const start = (req.body.start_date || '').trim();
  if (!timelineUtil.isValidISODate(start)) return redirectTimeline(req, res, projectId, false, 'msg=Invalid+start+date');
  const dur = Math.max(1, parseInt(req.body.duration_days, 10) || DEFAULT_DESIGN_TIMELINE_DAYS);
  const end = timelineUtil.endDateFromStartAndDuration(start, dur);
  await portalDb.updateProject(projectId, { design_timeline_start: start, design_timeline_end: end, design_timeline_duration_days: dur });
  const p = await portalDb.getProjectById(projectId);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `Design timeline was set for «${p?.title || 'Project'}».`,
      projectId,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  redirectTimeline(req, res, projectId, false, '');
});

router.post('/designer/projects/:id/timeline/execution/init', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, projectId, 'timelines'))) return res.status(403).send('Forbidden');
  if (project.execution_timeline_start) return redirectTimeline(req, res, projectId, false, 'msg=Execution+timeline+already+set');
  const start = (req.body.start_date || '').trim();
  if (!timelineUtil.isValidISODate(start)) return redirectTimeline(req, res, projectId, false, 'msg=Invalid+start+date');
  const dur = Math.max(1, parseInt(req.body.duration_days, 10) || DEFAULT_EXECUTION_TIMELINE_DAYS);
  const end = timelineUtil.endDateFromStartAndDuration(start, dur);
  await portalDb.updateProject(projectId, { execution_timeline_start: start, execution_timeline_end: end, execution_timeline_duration_days: dur });
  const p2 = await portalDb.getProjectById(projectId);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.TIMELINE,
      message: `Execution timeline was set for «${p2?.title || 'Project'}».`,
      projectId,
      tabSuffix: '#tab-timelines',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  redirectTimeline(req, res, projectId, false, '');
});

router.post('/designer/projects/:id/timeline/extension', express.urlencoded({ extended: true }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, projectId, 'timelines'))) return res.status(403).send('Forbidden');
  const phase = (req.body.phase || '').toUpperCase();
  if (phase !== 'DESIGN' && phase !== 'EXECUTION') return redirectTimeline(req, res, projectId, false, 'msg=Invalid+phase');
  const extra = parseInt(req.body.extra_days, 10);
  const reason = (req.body.reason || '').trim();
  if (!reason || !Number.isFinite(extra) || extra < 1 || extra > 999) return redirectTimeline(req, res, projectId, false, 'msg=Invalid+extension');
  const curEnd = phase === 'DESIGN' ? project.design_timeline_end : project.execution_timeline_end;
  if (!curEnd) return redirectTimeline(req, res, projectId, false, 'msg=Complete+timeline+for+that+phase+first');
  await portalDb.createTimelineExtension(projectId, phase, extra, reason, req.session[PORTAL_USER_ID], 'DESIGNER');
  portalNotify.safeNotify(
    portalNotify.notifyAdmins(portalDb, {
      category: NC.TIMELINE,
      message: `Designer requested +${extra} day(s) on ${phase} timeline for «${project.title}».`,
      linkUrl: `/portal/admin/projects/${projectId}#tab-timelines`,
      projectId,
    })
  );
  redirectTimeline(req, res, projectId, false, '');
});

// Admin Design Vault upload (2D/3D go to design review; SITE_LOG/OFFICIAL_DOCS as before)
router.post('/admin/projects/:id/media', requirePortalAuth, requireAdmin, portalUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const category = (req.body?.category || 'SITE_LOG').toUpperCase();
  if (!req.file) {
    const redirectTab =
      category === 'OTHER_DOCS'
        ? '#tab-other-docs'
        : category === 'VASTU'
          ? '#tab-vastu'
          : category === 'WARRANTY_GUARANTEE'
            ? '#tab-warranty'
            : '#tab-vault';
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=No+file' + redirectTab);
  }
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  let seventhArg = { uploadedByRole: 'ADMIN' };
  if (category === 'VASTU') {
    seventhArg = {
      uploadedByRole: 'ADMIN',
      vastuCategoryName: (req.body?.vastu_category_name || '').trim() || null,
    };
  } else if (category === 'OTHER_DOCS') {
    seventhArg = {
      uploadedByRole: 'ADMIN',
      visibleToDesigner: req.body?.share_with_designer === '1' ? 1 : 0,
    };
  }
  const uploadType =
    category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS'
      ? req.file.mimetype.startsWith('video')
        ? 'VIDEO'
        : 'PHOTO'
      : inferPortalUploadMediaType(req.file);
  const mediaId = await portalDb.addProjectMedia(projectId, url, uploadType, category, req.file.originalname, req.file.size, seventhArg);
  if (category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS') {
    const areaTag = (req.body?.area_tag || '').trim() || (req.body?.area_tag_custom || '').trim() || 'General';
    const designId = await portalDb.createDesign(projectId, category, areaTag);
    await portalDb.createDesignVersion(designId, mediaId, req.session[PORTAL_USER_ID], 'PENDING_ADMIN', 'PENDING');
  }
  const redirectTab =
    category === 'OTHER_DOCS'
      ? '#tab-other-docs'
      : category === 'VASTU'
        ? '#tab-vastu'
        : category === 'WARRANTY_GUARANTEE'
          ? '#tab-warranty'
          : '#tab-vault';
  const catLabel =
    category === 'SITE_LOG'
      ? 'site log'
      : category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS'
        ? 'design vault'
        : category.replace(/_/g, ' ').toLowerCase();
  const isDesignVaultPending = category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS';
  const needsAdminDocPublish = ['WARRANTY_GUARANTEE', 'VASTU', 'OTHER_DOCS'].includes(category);
  const notifyClient = !isDesignVaultPending && !needsAdminDocPublish;
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEDIA,
      message: `New ${catLabel} media was added to «${project.title}».`,
      projectId,
      tabSuffix: redirectTab,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: notifyClient,
    })
  );
  res.redirect('/portal/admin/projects/' + projectId + redirectTab);
});

router.post('/admin/projects/:id/mood-board', requirePortalAuth, requireAdmin, moodBoardUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  if (!req.file) {
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=No+file+selected#tab-mood-board');
  }
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  const uploadType = inferPortalUploadMediaType(req.file);
  await portalDb.addProjectMedia(projectId, url, uploadType, 'MOOD_BOARD', req.file.originalname, req.file.size, {
    uploadedByRole: 'ADMIN',
  });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEDIA,
      message: `New mood board file was added to «${project.title}».`,
      projectId,
      tabSuffix: '#tab-mood-board',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  res.redirect('/portal/admin/projects/' + projectId + '#tab-mood-board');
});

router.post(
  '/admin/projects/:id/design-ideas/:ideaId/comment',
  express.urlencoded({ extended: true }),
  requirePortalAuth,
  requireAdmin,
  async (req, res) => {
    const projectId = req.params.id;
    const ideaId = req.params.ideaId;
    const body = String(req.body.body || '').trim();
    if (!body) return res.redirect('/portal/admin/projects/' + projectId + '#idea-' + ideaId);
    const idea = await portalDb.getDesignIdeaByIdInProject(ideaId, projectId);
    if (!idea) return res.status(404).send('Not found');
    await portalDb.addDesignIdeaComment(ideaId, req.session[PORTAL_USER_ID], body);
    const proj = await portalDb.getProjectById(projectId);
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.COMMENT,
        message: `Your studio replied on a design inspiration for «${proj?.title || 'Project'}».`,
        projectId,
        tabSuffix: '#tab-design-ideas',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: true,
      })
    );
    res.redirect('/portal/admin/projects/' + projectId + '#idea-' + ideaId);
  }
);

router.post('/admin/projects/:id/designer-messaging', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Not found');
  const enabled = req.body.enable_designer_messaging === '1';
  await portalDb.updateProject(projectId, { designer_client_messaging_enabled: enabled ? 1 : 0 });
  res.redirect('/portal/admin/projects/' + projectId + '#tab-messages');
});

router.post('/admin/projects/:id/messages', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Not found');
  const body = String(req.body.body || '').trim();
  if (!body) {
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=' + encodeURIComponent('Message is required.') + '#tab-messages');
  }
  try {
    await portalDb.createProjectMessage(projectId, req.session[PORTAL_USER_ID], 'ADMIN', body, { priority: req.body.priority });
  } catch (_e) {
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=' + encodeURIComponent('Could not save message.') + '#tab-messages');
  }
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MESSAGE,
      message: `New studio message on «${project.title}». Open Messages to read and reply.`,
      projectId,
      tabSuffix: '#tab-messages',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: true,
    })
  );
  res.redirect('/portal/admin/projects/' + projectId + '#tab-messages');
});

router.post('/admin/projects/:id/messages/:msgId/reply', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const parentId = req.params.msgId;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Not found');
  const parent = await portalDb.getProjectMessageById(parentId, projectId);
  if (!parent) {
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=' + encodeURIComponent('Message not found.') + '#tab-messages');
  }
  const body = String(req.body.body || '').trim();
  if (!body) return res.redirect('/portal/admin/projects/' + projectId + '#tab-messages');
  try {
    await portalDb.createProjectMessage(projectId, req.session[PORTAL_USER_ID], 'ADMIN', body, { parentId });
  } catch (_e) {
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=' + encodeURIComponent('Could not save reply.') + '#tab-messages');
  }
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MESSAGE,
      message: `Your studio replied on messages for «${project.title}».`,
      projectId,
      tabSuffix: '#tab-messages',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: true,
    })
  );
  res.redirect('/portal/admin/projects/' + projectId + '#tab-messages');
});

const MEETING_TAB = '#tab-meetings';

router.post('/admin/projects/:id/meetings/propose', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const redir = '/portal/admin/projects/' + projectId + MEETING_TAB;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Not found');
  const slot = portalMeet.parseStartAndDuration(req.body.start_at, req.body.duration_minutes);
  if (!slot) return res.redirect(redir + '?meet_err=invalid_time');
  const title = (String(req.body.title || '').trim().slice(0, 500) || 'Project meeting');
  const notes = String(req.body.notes || '').trim().slice(0, 2000);
  const meetLink = String(req.body.meet_link || '').trim();
  if (meetLink && !portalMeet.looksLikeHttpUrl(meetLink)) return res.redirect(redir + '?meet_err=bad_link');
  if ((await portalDb.countOverlappingMeetings(projectId, slot.startIso, slot.endIso)) > 0) {
    return res.redirect(redir + '?meet_err=overlap');
  }
  const uid = req.session[PORTAL_USER_ID];
  await portalDb.createProjectMeeting({
    projectId,
    title,
    startIso: slot.startIso,
    endIso: slot.endIso,
    meetLink,
    proposedByUserId: uid,
    proposedByRole: req.session[PORTAL_USER_ROLE],
    status: portalDb.MEETING_STATUS.PENDING_CLIENT,
    awaitingParty: 'CLIENT',
    notes,
  });
  const msg = `A meeting was proposed for «${project.title}»: ${title}. Open Meetings to accept or decline.${
    meetLink ? ` Google Meet / call link: ${meetLink}` : ''
  }`;
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: msg,
      projectId,
      tabSuffix: MEETING_TAB,
      excludeUserIds: [uid],
      includeClient: true,
    })
  );
  res.redirect(redir);
});

router.post('/admin/projects/:id/meetings/:mid/accept', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/admin/projects/' + projectId + MEETING_TAB;
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.status !== portalDb.MEETING_STATUS.PENDING_STAFF) return res.redirect(redir);
  const meetLink = String(req.body.meet_link || '').trim();
  if (!portalMeet.looksLikeHttpUrl(meetLink)) return res.redirect(redir + '?meet_err=need_meet_link');
  await portalDb.updateMeetingStatus(projectId, mid, {
    status: portalDb.MEETING_STATUS.CONFIRMED,
    respondedByUserId: req.session[PORTAL_USER_ID],
    meetLink,
  });
  const project = await portalDb.getProjectById(projectId);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: `Meeting confirmed for «${project?.title || 'Project'}»: ${m.title}. Link: ${meetLink}`,
      projectId,
      tabSuffix: MEETING_TAB,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(redir);
});

router.post('/admin/projects/:id/meetings/:mid/decline', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/admin/projects/' + projectId + MEETING_TAB;
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.status !== portalDb.MEETING_STATUS.PENDING_STAFF) return res.redirect(redir);
  await portalDb.updateMeetingStatus(projectId, mid, {
    status: portalDb.MEETING_STATUS.DECLINED,
    respondedByUserId: req.session[PORTAL_USER_ID],
    declineReason: String(req.body.decline_reason || '').trim(),
  });
  const project = await portalDb.getProjectById(projectId);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: `A meeting request was declined for «${project?.title || 'Project'}»: ${m.title}.`,
      projectId,
      tabSuffix: MEETING_TAB,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(redir);
});

router.post('/admin/projects/:id/meetings/:mid/cancel', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/admin/projects/' + projectId + MEETING_TAB;
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.proposed_by_user_id !== req.session[PORTAL_USER_ID]) return res.redirect(redir);
  if (m.status !== portalDb.MEETING_STATUS.PENDING_CLIENT && m.status !== portalDb.MEETING_STATUS.PENDING_STAFF) {
    return res.redirect(redir);
  }
  await portalDb.updateMeetingStatus(projectId, mid, { status: portalDb.MEETING_STATUS.CANCELLED });
  res.redirect(redir);
});

router.post(
  '/admin/projects/:id/material-selection',
  requirePortalAuth,
  requireAdmin,
  materialsUpload.single('file'),
  async (req, res) => {
    const projectId = req.params.id;
    const project = await portalDb.getProjectById(projectId);
    if (!project) return res.status(404).send('Project not found');
    const code = (req.body && req.body.material_code) ? String(req.body.material_code).trim() : '';
    const areaTag =
      (req.body && (req.body.area_tag_custom || '').trim()) ||
      (req.body && (req.body.area_tag || '').trim()) ||
      'General';
    const linkedDesignVersionId = (req.body && req.body.linked_design_version_id)
      ? String(req.body.linked_design_version_id).trim()
      : '';
    if (!req.file || !code) {
      return res.redirect('/portal/admin/projects/' + projectId + '?msg=Photo+and+material+code+required#tab-material-selection');
    }
    const imageUrl = '/assets/uploads/portal/materials/' + path.basename(req.file.filename);
    await portalDb.createMaterialSelection({
      projectId,
      areaTag,
      linkedDesignVersionId: linkedDesignVersionId || null,
      materialCode: code,
      imageUrl,
      fileName: req.file.originalname,
      uploadedByUserId: req.session[PORTAL_USER_ID],
      uploadedByRole: 'ADMIN',
    });
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.DOCUMENTS,
        message: `New material selection (${areaTag} · code ${code}) was added to «${project.title}». Please review and approve.`,
        projectId,
        tabSuffix: '#tab-material-selection',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
    res.redirect('/portal/admin/projects/' + projectId + '#tab-material-selection');
  }
);

router.post('/admin/projects/:id/material-selection/:matId/delete', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const { id: projectId, matId } = req.params;
  const r = await portalDb.deleteMaterialSelection(projectId, matId);
  if (r.ok && r.image_url) unlinkPortalMaterialFile(r.image_url);
  res.redirect('/portal/admin/projects/' + projectId + '#tab-material-selection');
});

router.post('/admin/projects/:id/daily-updates', requirePortalAuth, requireAdmin, portalUpload.array('files', 20), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const text = (req.body && req.body.text) ? String(req.body.text).trim() : '';
  const files = req.files || [];
  if (!text && files.length === 0) return res.redirect('/portal/admin/projects/' + projectId + '?msg=Add+text+or+files#tab-daily');
  const reportDate = req.body && req.body.report_date;
  const updateId = await portalDb.createDailyUpdate(projectId, 'ADMIN', req.session[PORTAL_USER_ID], text || null, reportDate);
  for (const f of files) {
    const url = '/assets/uploads/portal/' + path.basename(f.filename);
    const type = f.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO';
    await portalDb.addDailyUpdateMedia(updateId, url, type, f.originalname, f.size);
  }
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DAILY,
      message: `New daily progress update on «${project.title}».`,
      projectId,
      tabSuffix: '#tab-daily',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/admin/projects/' + projectId + '#tab-daily');
});

router.post('/admin/projects/:id/daily-updates/:updateId/edit', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const updateId = req.params.updateId;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const existing = await portalDb.getDailyUpdateById(updateId);
  if (!existing || existing.project_id !== projectId) return res.redirect('/portal/admin/projects/' + projectId + '?msg=Update+not+found#tab-daily');
  const text = req.body && req.body.text != null ? String(req.body.text).trim() : '';
  const mediaRows = await portalDb.all(
    'SELECT id FROM portal_daily_update_media WHERE update_id = ?',
    [updateId]
  );
  if (!text && (!mediaRows || mediaRows.length === 0)) {
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=Add+text+or+keep+at+least+one+file#tab-daily');
  }
  await portalDb.updateDailyUpdateText(
    updateId,
    text || null,
    req.body != null && Object.prototype.hasOwnProperty.call(req.body, 'report_date') ? req.body.report_date : undefined
  );
  res.redirect('/portal/admin/projects/' + projectId + '#tab-daily');
});

router.post('/admin/projects/:id/daily-updates/:updateId/delete', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const updateId = req.params.updateId;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const ok = await portalDb.deleteDailyUpdateForProject(projectId, updateId);
  if (!ok) return res.redirect('/portal/admin/projects/' + projectId + '?msg=Update+not+found#tab-daily');
  res.redirect('/portal/admin/projects/' + projectId + '#tab-daily');
});

router.post('/admin/projects/:id/daily-updates/:updateId/publish-client', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const existing = await portalDb.getDailyUpdateById(req.params.updateId);
  if (!existing || existing.project_id !== projectId) {
    return res.redirect('/portal/admin/projects/' + projectId + '?msg=Update+not+found#tab-daily');
  }
  const wasHidden = Number(existing.visible_to_client) !== 1;
  const ok = await portalDb.setDailyUpdateVisibleToClient(projectId, req.params.updateId, true);
  if (!ok) return res.redirect('/portal/admin/projects/' + projectId + '?msg=Update+not+found#tab-daily');
  if (wasHidden) {
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.DAILY,
        message: `A daily progress update was published for «${project.title}».`,
        projectId,
        tabSuffix: '#tab-daily',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
  res.redirect('/portal/admin/projects/' + projectId + '#tab-daily');
});

router.post('/admin/projects/:id/daily-updates/:updateId/media/:mediaId/delete', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const updateId = req.params.updateId;
  const mediaId = req.params.mediaId;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const existing = await portalDb.getDailyUpdateById(updateId);
  if (!existing || existing.project_id !== projectId) return res.redirect('/portal/admin/projects/' + projectId + '?msg=Update+not+found#tab-daily');
  const ok = await portalDb.deleteDailyUpdateMediaForProject(projectId, mediaId);
  if (!ok) return res.redirect('/portal/admin/projects/' + projectId + '?msg=File+not+found#tab-daily');
  const after = await portalDb.getDailyUpdateById(updateId);
  const mediaLeft = await portalDb.all('SELECT id FROM portal_daily_update_media WHERE update_id = ?', [updateId]);
  const hasText = after && after.text && String(after.text).trim();
  if ((!mediaLeft || mediaLeft.length === 0) && !hasText) {
    await portalDb.deleteDailyUpdateForProject(projectId, updateId);
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
  const extraCostsAfter = await portalDb.getExtraCostsByQuotationId(quotation.id);
  const sched = buildPaymentScheduleViewForProject(project, quotation, extraCostsAfter, await portalDb.getClientPaymentsByProject(project.id));
  const fp = fingerprintPaymentSchedule(sched);
  await portalDb.updateProject(project.id, { payment_schedule_notify_fingerprint: fp });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: `Quotation was updated for «${project.title}». ${buildPaymentScheduleShortLine(sched)}`,
      projectId: project.id,
      tabSuffix: '#tab-finance',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
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
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: `Quotation PDF was updated for «${project.title}».`,
      projectId: project.id,
      tabSuffix: '#tab-finance',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
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
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: `A new extra cost / variation was added on «${project.title}».`,
      projectId: project.id,
      tabSuffix: '#tab-finance',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
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
  if (message) {
    await portalDb.addExtraCostComment(ec.id, 'ADMIN', req.session[PORTAL_USER_ID], message);
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.COMMENT,
        message: `Admin replied on a variation for «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-finance',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
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
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: `A variation was revised on «${project.title}».`,
      projectId: project.id,
      tabSuffix: '#tab-finance',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/payments', express.urlencoded({ extended: true }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const amount = parseFloat(req.body.amount);
  const receivedDate = (req.body.received_date || '').trim();
  const note = (req.body.note || '').trim() || null;
  if (!receivedDate || !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate) || Number.isNaN(amount) || amount <= 0) {
    return res.redirect('/portal/admin/projects/' + req.params.id + '?msg=Invalid+payment#tab-finance');
  }
  await portalDb.addClientPayment(project.id, amount, receivedDate, note);
  portalNotify.safeNotify(
    portalNotify.notifyAdmins(portalDb, {
      category: NC.FINANCE,
      message: `Payment recorded for «${project.title}» (₹${amount.toLocaleString('en-IN')}).`,
      linkUrl: `/portal/admin/projects/${project.id}#tab-finance`,
      projectId: project.id,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/payments/:paymentId/approve-client', requirePortalAuth, requireAdmin, async (req, res) => {
  const ok = await portalDb.setClientPaymentApprovedForClient(req.params.paymentId, req.params.id, true);
  if (!ok) return res.redirect('/portal/admin/projects/' + req.params.id + '?msg=Payment+not+found#tab-finance');
  const project = await portalDb.getProjectById(req.params.id);
  if (project) {
    const ctx = await getPaymentScheduleContext(project.id);
    if (ctx) await portalDb.updateProject(project.id, { payment_schedule_notify_fingerprint: ctx.fp });
    const tail = ctx ? buildPaymentScheduleShortLine(ctx.result) : '';
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.FINANCE,
        message: `A payment is now visible for you on «${project.title}». ${tail}`,
        projectId: project.id,
        tabSuffix: '#tab-finance',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        skipClientEmail: true,
      })
    );
    const pay = await portalDb.getClientPaymentById(req.params.paymentId);
    if (pay && pay.project_id === project.id && Number(pay.amount) > 0) {
      const clientRecipients = await portalDb.getProjectClientRecipientUsers(project.id);
      for (const cr of clientRecipients) {
        if (!cr.email) continue;
        await sendClientPaymentThankYouEmail({
          toEmail: cr.email,
          recipientName: cr.full_name,
          projectTitle: project.title,
          projectId: project.id,
          amount: Number(pay.amount) || 0,
          receivedDate: pay.received_date,
          note: pay.note,
          scheduleHint: tail,
        });
      }
    }
  }
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/payments/:paymentId/hide-from-client', requirePortalAuth, requireAdmin, async (req, res) => {
  await portalDb.setClientPaymentApprovedForClient(req.params.paymentId, req.params.id, false);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/payments/:paymentId/delete', requirePortalAuth, requireAdmin, async (req, res) => {
  await portalDb.deleteClientPayment(req.params.paymentId, req.params.id);
  await maybeNotifyPaymentScheduleIfChanged(req.params.id, [req.session[PORTAL_USER_ID]]);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-finance');
});

router.post('/admin/projects/:id/complete', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const quotation = await portalDb.getLatestQuotationByProjectId(projectId);
  const extraCosts = quotation ? await portalDb.getExtraCostsByQuotationId(quotation.id) : [];
  const finalTotal = calculateProjectTotal(quotation, extraCosts);
  const clientPayments = await portalDb.getClientPaymentsByProject(projectId);
  if (!canMarkProjectCompletedByBalance(finalTotal, clientPayments)) {
    return res.redirect(
      `/portal/admin/projects/${projectId}?msg=${encodeURIComponent(
        'Mark Completed is only allowed when client balance due is zero or less (published payments must cover the contract total). See Finance tab.'
      )}`
    );
  }
  await portalDb.updateProject(projectId, { status: 'COMPLETED', final_total_cost: finalTotal, dv_points_processed: 1 });
  const lead = await portalDb.getLeadByConvertedProjectId(projectId);
  if (lead && lead.referrer_id) {
    const reward = finalTotal * 0.04;
    await portalDb.updateDvPoints(lead.referrer_id, reward);
    await portalDb.createNotification(lead.referrer_id, `You've earned ₹${Math.round(reward).toLocaleString()} DV points from your referral! (4% of project completion)`, {
      category: NC.SYSTEM,
      linkUrl: '/portal/client',
    });
  }
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.PROJECT,
      message: `Project «${project.title}» was marked completed.`,
      projectId,
      tabSuffix: '#tab-updates',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
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
  if (project && version) {
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.DESIGN,
        message: `A design version was approved by admin on «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-vault',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

router.post('/admin/projects/:id/design-version/:versionId/reject', requirePortalAuth, requireAdmin, async (req, res) => {
  const { version, design, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  if (version) await portalDb.updateDesignVersion(version.id, { admin_status: 'REJECTED' });
  if (project && version) {
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.DESIGN,
        message: `A design version needs revision on «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-vault',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: false,
      })
    );
  }
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
  if (version && message) {
    await portalDb.addDesignComment(version.id, 'ADMIN', req.session[PORTAL_USER_ID], message);
    const clientSeesVersion = version.admin_status === 'APPROVED';
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.COMMENT,
        message: `New design comment from admin on «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-vault',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: clientSeesVersion,
      })
    );
  }
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
  const row = await portalDb.get('SELECT category FROM portal_media WHERE id = ? AND project_id = ?', [
    req.params.mediaId,
    req.params.id,
  ]);
  await portalDb.deleteProjectMedia(req.params.id, req.params.mediaId);
  const hash = row && row.category === 'MOOD_BOARD' ? '#tab-mood-board' : '#tab-vault';
  res.redirect('/portal/admin/projects/' + req.params.id + hash);
});

router.post('/admin/projects/:id/media/:mediaId/publish-client', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const mediaRow = await portalDb.get(
    'SELECT approved, category FROM portal_media WHERE id = ? AND project_id = ?',
    [req.params.mediaId, project.id]
  );
  if (!mediaRow || (mediaRow.category !== 'SITE_LOG' && mediaRow.category !== 'OFFICIAL_DOCS')) {
    return res.redirect('/portal/admin/projects/' + project.id + '?msg=Only+site+log+or+official+docs+can+be+published+here#tab-vault');
  }
  const wasHidden = Number(mediaRow.approved) !== 1;
  const ok = await portalDb.approveSiteLogOrOfficialForClient(project.id, req.params.mediaId);
  if (!ok) return res.redirect('/portal/admin/projects/' + project.id + '?msg=Could+not+publish#tab-vault');
  if (wasHidden) {
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.MEDIA,
        message: `New approved site or document media is available for «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-vault',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
  res.redirect('/portal/admin/projects/' + project.id + '#tab-vault');
});

router.post('/admin/projects/:id/design-version/:versionId/delete', requirePortalAuth, requireAdmin, async (req, res) => {
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
  await portalDb.deleteDesignVersion(req.params.versionId);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vault');
});

// Admin: approve/delete warranty & guarantee documents
router.post('/admin/projects/:id/warranty/:mediaId/approve', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  await portalDb.run('UPDATE portal_media SET approved = 1 WHERE id = ? AND project_id = ? AND category = ?', [req.params.mediaId, project.id, 'WARRANTY_GUARANTEE']);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DOCUMENTS,
      message: `A warranty document was published for «${project.title}».`,
      projectId: project.id,
      tabSuffix: '#tab-warranty',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-warranty');
});

router.post('/admin/projects/:id/warranty/:mediaId/delete', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  await portalDb.deleteProjectMedia(req.params.id, req.params.mediaId);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-warranty');
});

// Admin: approve/delete Vastu documents
router.post('/admin/projects/:id/vastu/:mediaId/approve', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  await portalDb.run('UPDATE portal_media SET approved = 1 WHERE id = ? AND project_id = ? AND category = ?', [req.params.mediaId, project.id, 'VASTU']);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DOCUMENTS,
      message: `A Vastu document was published for «${project.title}».`,
      projectId: project.id,
      tabSuffix: '#tab-vastu',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vastu');
});

router.post('/admin/projects/:id/vastu/:mediaId/delete', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  await portalDb.deleteProjectMedia(req.params.id, req.params.mediaId);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-vastu');
});

router.post('/admin/projects/:id/other-docs/:mediaId/approve', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  await portalDb.updateOtherDocMedia(project.id, req.params.mediaId, { approved: true });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DOCUMENTS,
      message: `An other document was published for «${project.title}».`,
      projectId: project.id,
      tabSuffix: '#tab-other-docs',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/admin/projects/' + project.id + '#tab-other-docs');
});

router.post('/admin/projects/:id/other-docs/:mediaId/visibility', express.urlencoded({ extended: false }), requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  const visible = req.body?.visible_to_designer === '1';
  await portalDb.updateOtherDocMedia(project.id, req.params.mediaId, { visible_to_designer: visible });
  res.redirect('/portal/admin/projects/' + project.id + '#tab-other-docs');
});

router.post('/admin/projects/:id/other-docs/:mediaId/delete', requirePortalAuth, requireAdmin, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  await portalDb.deleteProjectMedia(req.params.id, req.params.mediaId);
  res.redirect('/portal/admin/projects/' + req.params.id + '#tab-other-docs');
});

// Admin: add new version to existing design (upload) – same behavior as designer route but under /admin
router.post('/admin/projects/:id/design/:designId/version', requirePortalAuth, requireAdmin, portalUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project) return res.status(404).send('Project not found');
  const design = await portalDb.getDesignById(req.params.designId);
  if (!design || design.project_id !== projectId) return res.redirect('/portal/admin/projects/' + projectId + '#tab-vault');
  if (!req.file) return res.redirect('/portal/admin/projects/' + projectId + '?msg=No+file#tab-vault');
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  const mediaId = await portalDb.addProjectMedia(
    projectId,
    url,
    req.file.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO',
    design.category,
    req.file.originalname,
    req.file.size
  );
  // New version should not auto-carry old 2D/3D links; admin/designer explicitly relink.
  await portalDb.clearDesignLinks(design.id);
  await portalDb.createDesignVersion(design.id, mediaId, req.session[PORTAL_USER_ID], 'PENDING_ADMIN', 'PENDING');
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DESIGN,
      message: `New design version uploaded on «${project.title}».`,
      projectId,
      tabSuffix: '#tab-vault',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  res.redirect('/portal/admin/projects/' + projectId + '#tab-vault');
});

// ----- Designer Dashboard -----
router.get('/designer', requirePortalAuth, requireDesigner, async (req, res) => {
  const designerId = req.session[PORTAL_USER_ID];
  const [leads, projects, notifications] = await Promise.all([
    portalDb.getLeadsForDesigner(designerId),
    portalDb.getProjectsForDesigner(designerId),
    portalDb.getNotificationsForUser(designerId, 15),
  ]);
  const pendingFollowUps = leads.filter((l) => l.next_follow_up && new Date(l.next_follow_up) <= new Date());
  (projects || []).forEach((p) => enrichProjectLifecycle(p));
  renderPortal(req, res, 'portal/designer/dashboard', { leads, projects, pendingFollowUps, notifications: notifications || [] });
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
  if (note) {
    await portalDb.addLeadActivity(req.params.id, note);
    portalNotify.safeNotify(
      portalNotify.notifyLeadStakeholders(portalDb, {
        category: NC.LEAD,
        message: `New designer note on lead «${lead.name}».`,
        leadId: req.params.id,
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
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
  (projects || []).forEach((p) => enrichProjectLifecycle(p));
  renderPortal(req, res, 'portal/designer/projects', { projects });
});

router.get('/designer/projects/:id/worksite', requirePortalAuth, requireDesigner, async (req, res) => {
  const ctx = await resolveProjectWorksiteAccess(req, req.params.id);
  if (!ctx) return res.status(403).send('Forbidden');
  return renderWorksitePage(req, res, ctx);
});

router.post(
  '/designer/projects/:id/worksite',
  express.urlencoded({ extended: true }),
  requirePortalAuth,
  requireDesigner,
  async (req, res) => {
    const ctx = await resolveProjectWorksiteAccess(req, req.params.id);
    if (!ctx) return res.status(403).send('Forbidden');
    return handleWorksitePost(req, res, ctx);
  }
);

router.get('/designer/projects/:id', requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectWithRelations(req.params.id);
  if (!project) return res.status(404).send('Project not found');
  let designerAllowedTabs = {};
  if (req.session[PORTAL_USER_ROLE] === 'ADMIN') {
    for (const k of portalDb.DESIGNER_PORTAL_TAB_KEYS) designerAllowedTabs[k] = true;
  } else {
    const dAccess = await portalDb.getDesignerProjectPortalAccess(req.session[PORTAL_USER_ID], project.id);
    if (!dAccess) return res.status(403).send('Forbidden');
    for (const k of portalDb.DESIGNER_PORTAL_TAB_KEYS) {
      designerAllowedTabs[k] = dAccess.allowedTabs.has(k);
    }
  }
  const media = await portalDb.getProjectMedia(project.id);
  const mediaList = media || [];
  const siteLog = mediaList.filter((m) => m.category === 'SITE_LOG');
  const byYearMonth = groupMediaByDate(siteLog);
  // For client view, do NOT surface raw 2D/3D media; only admin-approved design versions
  const mediaByCategory = {
    ARCHITECTURAL_PLANS: [],
    VISUALIZATIONS: [],
    SITE_LOG: siteLog,
    OFFICIAL_DOCS: mediaList.filter((m) => m.category === 'OFFICIAL_DOCS'),
  };
  const vaultMediaList = buildVaultMediaList(mediaList.filter((m) => m.category !== 'ARCHITECTURAL_PLANS' && m.category !== 'VISUALIZATIONS'));
  const vastuDocs = mediaList.filter((m) => m.category === 'VASTU');
  const otherDocs = mediaList.filter(
    (m) =>
      m.category === 'OTHER_DOCS' &&
      (Number(m.visible_to_designer) === 1 || m.visible_to_designer == null)
  );
  const moodBoardFiles = mediaList.filter((m) => m.category === 'MOOD_BOARD');
  const [dailyUpdates, projectDesigns, timelineExtensions, materialSelections, designsForMaterialLink] = await Promise.all([
    portalDb.getDailyUpdatesByProject(project.id),
    portalDb.getDesignsForProjectWithDetails(project.id, { forClient: false }),
    portalDb.getTimelineExtensions(project.id),
    portalDb.getMaterialSelectionsForProject(project.id),
    portalDb.getDesignsForProjectWithDetails(project.id, { forClient: true }),
  ]);
  enrichProjectLifecycle(project);
  const projectMessagesRaw = await portalDb.getProjectMessages(project.id);
  const projectMessageThreads = groupPortalProjectMessages(projectMessagesRaw);
  const projectMeetings = enrichProjectMeetingsList(await portalDb.getProjectMeetings(project.id));
  const [designIdeaAreas, designIdeasWithComments] = await Promise.all([
    portalDb.listDesignIdeaAreasForProject(project.id),
    portalDb.listDesignIdeasWithCommentsForProject(project.id),
  ]);
  renderPortal(req, res, 'portal/designer/project_detail', {
    project,
    query: req.query,
    media: mediaList,
    mediaByCategory,
    byYearMonth,
    vaultMediaList,
    dailyUpdates: dailyUpdates || [],
    projectDesigns,
    vastuDocs,
    otherDocs,
    moodBoardFiles,
    timelineExtensions: timelineExtensions || [],
    materialSelections: materialSelections || [],
    designsForMaterialLink: designsForMaterialLink || [],
    designerAllowedTabs,
    projectMessageThreads,
    messagePriorities: portalDb.MESSAGE_PRIORITY_LEVELS,
    designerMessagingEnabled: Number(project.designer_client_messaging_enabled) === 1,
    projectMeetings,
    designIdeaAreas: designIdeaAreas || [],
    designIdeasWithComments: designIdeasWithComments || [],
  });
});

router.post('/designer/projects/:id/update', express.urlencoded({ extended: true }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, req.params.id, 'updates'))) return res.status(403).send('Forbidden');
  const updates = {};
  if (req.body.lifecycle_update === '1') {
    Object.assign(updates, buildLifecycleUpdates(req.body));
  }
  if (req.body.title !== undefined) {
    const t = String(req.body.title).trim();
    if (t && t !== project.title) updates.title = t;
  }
  if (req.body.rtsp_link !== undefined) {
    const v = String(req.body.rtsp_link).trim() || null;
    const prev = project.rtsp_link || null;
    if (v !== prev) updates.rtsp_link = v;
  }
  if (Object.keys(updates).length) {
    await portalDb.updateProject(req.params.id, updates);
    const p = await portalDb.getProjectById(req.params.id);
    if (p) {
      const hadLifecycle = req.body.lifecycle_update === '1';
      const hadTitle = updates.title !== undefined;
      const hadRtsp = updates.rtsp_link !== undefined;
      let message = `Project details were updated on «${p.title}».`;
      if (hadLifecycle && (hadTitle || hadRtsp)) message = `Project lifecycle and details were updated on «${p.title}».`;
      else if (hadLifecycle) message = `Project lifecycle stages were updated on «${p.title}».`;
      else if (hadTitle) message = `Project name was updated to «${p.title}».`;
      else if (hadRtsp) message = `Live site view link was updated on «${p.title}».`;
      portalNotify.safeNotify(
        portalNotify.notifyProjectStakeholders(portalDb, {
          category: NC.PROJECT,
          message,
          projectId: p.id,
          tabSuffix: '#tab-updates',
          excludeUserIds: [req.session[PORTAL_USER_ID]],
          includeClient: !hadLifecycle && (hadTitle || hadRtsp),
        })
      );
    }
  }
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-updates');
});

router.post('/designer/projects/:id/media', requirePortalAuth, requireDesigner, portalUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  const category = (req.body?.category || 'SITE_LOG').toUpperCase();
  if (!(await assertDesignerTab(req, projectId, designerTabKeyForMediaCategory(category)))) return res.status(403).send('Forbidden');
  if (!req.file) {
    const redirectTab =
      category === 'OTHER_DOCS'
        ? '#tab-other-docs'
        : category === 'VASTU'
          ? '#tab-vastu'
          : category === 'WARRANTY_GUARANTEE'
            ? '#tab-warranty'
            : '#tab-vault';
    return res.redirect('/portal/designer/projects/' + projectId + '?msg=No+file' + redirectTab);
  }
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  let seventhArg = { uploadedByRole: 'DESIGNER' };
  if (category === 'VASTU') {
    seventhArg = {
      uploadedByRole: 'DESIGNER',
      vastuCategoryName: (req.body?.vastu_category_name || '').trim() || null,
    };
  } else if (category === 'OTHER_DOCS') {
    seventhArg = { uploadedByRole: 'DESIGNER', visibleToDesigner: 1 };
  }
  const uploadType =
    category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS'
      ? req.file.mimetype.startsWith('video')
        ? 'VIDEO'
        : 'PHOTO'
      : inferPortalUploadMediaType(req.file);
  const mediaId = await portalDb.addProjectMedia(projectId, url, uploadType, category, req.file.originalname, req.file.size, seventhArg);
  if (category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS') {
    const areaTag = (req.body?.area_tag || '').trim() || (req.body?.area_tag_custom || '').trim() || 'General';
    const designId = await portalDb.createDesign(projectId, category, areaTag);
    await portalDb.createDesignVersion(designId, mediaId, req.session[PORTAL_USER_ID], 'PENDING_ADMIN', 'PENDING');
  }
  const redirectTab =
    category === 'OTHER_DOCS'
      ? '#tab-other-docs'
      : category === 'VASTU'
        ? '#tab-vastu'
        : category === 'WARRANTY_GUARANTEE'
          ? '#tab-warranty'
          : '#tab-vault';
  const catLabel =
    category === 'SITE_LOG'
      ? 'site log'
      : category === 'ARCHITECTURAL_PLANS' || category === 'VISUALIZATIONS'
        ? 'design vault'
        : category.replace(/_/g, ' ').toLowerCase();
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEDIA,
      message: `New ${catLabel} media was added to «${project.title}».`,
      projectId,
      tabSuffix: redirectTab,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  res.redirect('/portal/designer/projects/' + projectId + redirectTab);
});

router.post('/designer/projects/:id/mood-board', requirePortalAuth, requireDesigner, moodBoardUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'mood-board'))) return res.status(403).send('Forbidden');
  if (!req.file) {
    return res.redirect('/portal/designer/projects/' + projectId + '?msg=No+file+selected#tab-mood-board');
  }
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  const uploadType = inferPortalUploadMediaType(req.file);
  await portalDb.addProjectMedia(projectId, url, uploadType, 'MOOD_BOARD', req.file.originalname, req.file.size, {
    uploadedByRole: 'DESIGNER',
  });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEDIA,
      message: `New mood board file was added to «${project.title}».`,
      projectId,
      tabSuffix: '#tab-mood-board',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  res.redirect('/portal/designer/projects/' + projectId + '#tab-mood-board');
});

router.post(
  '/designer/projects/:id/design-ideas/:ideaId/comment',
  express.urlencoded({ extended: true }),
  requirePortalAuth,
  requireDesigner,
  async (req, res) => {
    const projectId = req.params.id;
    const ideaId = req.params.ideaId;
    const project = await portalDb.getProjectById(projectId);
    if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
      return res.status(403).send('Forbidden');
    }
    if (!(await assertDesignerTab(req, projectId, 'design-ideas'))) return res.status(403).send('Forbidden');
    const body = String(req.body.body || '').trim();
    if (!body) return res.redirect('/portal/designer/projects/' + projectId + '#idea-' + ideaId);
    const idea = await portalDb.getDesignIdeaByIdInProject(ideaId, projectId);
    if (!idea) return res.status(404).send('Not found');
    await portalDb.addDesignIdeaComment(ideaId, req.session[PORTAL_USER_ID], body);
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.COMMENT,
        message: `Your studio replied on a design inspiration for «${project.title}».`,
        projectId,
        tabSuffix: '#tab-design-ideas',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: true,
      })
    );
    res.redirect('/portal/designer/projects/' + projectId + '#idea-' + ideaId);
  }
);

router.post('/designer/projects/:id/messages', express.urlencoded({ extended: true }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'messages'))) return res.status(403).send('Forbidden');
  if (Number(project.designer_client_messaging_enabled) !== 1) {
    return res.redirect(
      '/portal/designer/projects/' +
        projectId +
        '?msg=' +
        encodeURIComponent('Admin has disabled designer messaging for this project.') +
        '#tab-messages'
    );
  }
  const body = String(req.body.body || '').trim();
  if (!body) return res.redirect('/portal/designer/projects/' + projectId + '#tab-messages');
  try {
    await portalDb.createProjectMessage(projectId, req.session[PORTAL_USER_ID], 'DESIGNER', body, { priority: req.body.priority });
  } catch (_e) {
    return res.redirect('/portal/designer/projects/' + projectId + '?msg=' + encodeURIComponent('Could not save message.') + '#tab-messages');
  }
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MESSAGE,
      message: `New studio message on «${project.title}». Open Messages to read and reply.`,
      projectId,
      tabSuffix: '#tab-messages',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: true,
    })
  );
  res.redirect('/portal/designer/projects/' + projectId + '#tab-messages');
});

router.post('/designer/projects/:id/messages/:msgId/reply', express.urlencoded({ extended: true }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const parentId = req.params.msgId;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'messages'))) return res.status(403).send('Forbidden');
  if (Number(project.designer_client_messaging_enabled) !== 1) {
    return res.redirect('/portal/designer/projects/' + projectId + '#tab-messages');
  }
  const parent = await portalDb.getProjectMessageById(parentId, projectId);
  if (!parent) return res.redirect('/portal/designer/projects/' + projectId + '#tab-messages');
  const body = String(req.body.body || '').trim();
  if (!body) return res.redirect('/portal/designer/projects/' + projectId + '#tab-messages');
  try {
    await portalDb.createProjectMessage(projectId, req.session[PORTAL_USER_ID], 'DESIGNER', body, { parentId });
  } catch (_e) {
    return res.redirect('/portal/designer/projects/' + projectId + '#tab-messages');
  }
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MESSAGE,
      message: `Your studio replied on messages for «${project.title}».`,
      projectId,
      tabSuffix: '#tab-messages',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: true,
    })
  );
  res.redirect('/portal/designer/projects/' + projectId + '#tab-messages');
});

router.post('/designer/projects/:id/meetings/propose', express.urlencoded({ extended: true }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const redir = '/portal/designer/projects/' + projectId + MEETING_TAB;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'meetings'))) return res.status(403).send('Forbidden');
  const slot = portalMeet.parseStartAndDuration(req.body.start_at, req.body.duration_minutes);
  if (!slot) return res.redirect(redir + '?meet_err=invalid_time');
  const title = (String(req.body.title || '').trim().slice(0, 500) || 'Project meeting');
  const notes = String(req.body.notes || '').trim().slice(0, 2000);
  const meetLink = String(req.body.meet_link || '').trim();
  if (meetLink && !portalMeet.looksLikeHttpUrl(meetLink)) return res.redirect(redir + '?meet_err=bad_link');
  if ((await portalDb.countOverlappingMeetings(projectId, slot.startIso, slot.endIso)) > 0) {
    return res.redirect(redir + '?meet_err=overlap');
  }
  const uid = req.session[PORTAL_USER_ID];
  const role = req.session[PORTAL_USER_ROLE] === 'ADMIN' ? 'ADMIN' : 'DESIGNER';
  await portalDb.createProjectMeeting({
    projectId,
    title,
    startIso: slot.startIso,
    endIso: slot.endIso,
    meetLink,
    proposedByUserId: uid,
    proposedByRole: role,
    status: portalDb.MEETING_STATUS.PENDING_CLIENT,
    awaitingParty: 'CLIENT',
    notes,
  });
  const msg = `A meeting was proposed for «${project.title}»: ${title}. Open Meetings to accept or decline.${
    meetLink ? ` Link: ${meetLink}` : ''
  }`;
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: msg,
      projectId,
      tabSuffix: MEETING_TAB,
      excludeUserIds: [uid],
      includeClient: true,
    })
  );
  res.redirect(redir);
});

router.post('/designer/projects/:id/meetings/:mid/accept', express.urlencoded({ extended: true }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/designer/projects/' + projectId + MEETING_TAB;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'meetings'))) return res.status(403).send('Forbidden');
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.status !== portalDb.MEETING_STATUS.PENDING_STAFF) return res.redirect(redir);
  const meetLink = String(req.body.meet_link || '').trim();
  if (!portalMeet.looksLikeHttpUrl(meetLink)) return res.redirect(redir + '?meet_err=need_meet_link');
  await portalDb.updateMeetingStatus(projectId, mid, {
    status: portalDb.MEETING_STATUS.CONFIRMED,
    respondedByUserId: req.session[PORTAL_USER_ID],
    meetLink,
  });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: `Meeting confirmed for «${project.title}»: ${m.title}. Link: ${meetLink}`,
      projectId,
      tabSuffix: MEETING_TAB,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(redir);
});

router.post('/designer/projects/:id/meetings/:mid/decline', express.urlencoded({ extended: true }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/designer/projects/' + projectId + MEETING_TAB;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'meetings'))) return res.status(403).send('Forbidden');
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.status !== portalDb.MEETING_STATUS.PENDING_STAFF) return res.redirect(redir);
  await portalDb.updateMeetingStatus(projectId, mid, {
    status: portalDb.MEETING_STATUS.DECLINED,
    respondedByUserId: req.session[PORTAL_USER_ID],
    declineReason: String(req.body.decline_reason || '').trim(),
  });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: `A meeting request was declined for «${project.title}»: ${m.title}.`,
      projectId,
      tabSuffix: MEETING_TAB,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(redir);
});

router.post('/designer/projects/:id/meetings/:mid/cancel', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/designer/projects/' + projectId + MEETING_TAB;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'meetings'))) return res.status(403).send('Forbidden');
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.proposed_by_user_id !== req.session[PORTAL_USER_ID]) return res.redirect(redir);
  if (m.status !== portalDb.MEETING_STATUS.PENDING_CLIENT && m.status !== portalDb.MEETING_STATUS.PENDING_STAFF) {
    return res.redirect(redir);
  }
  await portalDb.updateMeetingStatus(projectId, mid, { status: portalDb.MEETING_STATUS.CANCELLED });
  res.redirect(redir);
});

router.post(
  '/designer/projects/:id/material-selection',
  requirePortalAuth,
  requireDesigner,
  materialsUpload.single('file'),
  async (req, res) => {
    const projectId = req.params.id;
    const project = await portalDb.getProjectById(projectId);
    if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
      return res.status(403).send('Forbidden');
    }
    if (!(await assertDesignerTab(req, projectId, 'material-selection'))) return res.status(403).send('Forbidden');
    const code = (req.body && req.body.material_code) ? String(req.body.material_code).trim() : '';
    const areaTag =
      (req.body && (req.body.area_tag_custom || '').trim()) ||
      (req.body && (req.body.area_tag || '').trim()) ||
      'General';
    const linkedDesignVersionId = (req.body && req.body.linked_design_version_id)
      ? String(req.body.linked_design_version_id).trim()
      : '';
    if (!req.file || !code) {
      return res.redirect('/portal/designer/projects/' + projectId + '?msg=Photo+and+material+code+required#tab-material-selection');
    }
    const imageUrl = '/assets/uploads/portal/materials/' + path.basename(req.file.filename);
    await portalDb.createMaterialSelection({
      projectId,
      areaTag,
      linkedDesignVersionId: linkedDesignVersionId || null,
      materialCode: code,
      imageUrl,
      fileName: req.file.originalname,
      uploadedByUserId: req.session[PORTAL_USER_ID],
      uploadedByRole: 'DESIGNER',
    });
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.DOCUMENTS,
        message: `New material selection (${areaTag} · code ${code}) was added to «${project.title}». Please review and approve.`,
        projectId,
        tabSuffix: '#tab-material-selection',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
    res.redirect('/portal/designer/projects/' + projectId + '#tab-material-selection');
  }
);

router.post('/designer/projects/:id/material-selection/:matId/delete', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const { id: projectId, matId } = req.params;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'material-selection'))) return res.status(403).send('Forbidden');
  const r = await portalDb.deleteMaterialSelection(projectId, matId);
  if (r.ok && r.image_url) unlinkPortalMaterialFile(r.image_url);
  res.redirect('/portal/designer/projects/' + projectId + '#tab-material-selection');
});

router.post('/designer/projects/:id/daily-updates', requirePortalAuth, requireDesigner, portalUpload.array('files', 20), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) {
    return res.status(403).send('Forbidden');
  }
  if (!(await assertDesignerTab(req, projectId, 'daily'))) return res.status(403).send('Forbidden');
  const text = (req.body && req.body.text) ? String(req.body.text).trim() : '';
  const files = req.files || [];
  if (!text && files.length === 0) return res.redirect('/portal/designer/projects/' + projectId + '?msg=Add+text+or+files#tab-daily');
  const updateId = await portalDb.createDailyUpdate(projectId, 'DESIGNER', req.session[PORTAL_USER_ID], text || null);
  for (const f of files) {
    const url = '/assets/uploads/portal/' + path.basename(f.filename);
    const type = f.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO';
    await portalDb.addDailyUpdateMedia(updateId, url, type, f.originalname, f.size);
  }
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DAILY,
      message: `New daily progress update was submitted for «${project.title}» (pending admin publish to client).`,
      projectId,
      tabSuffix: '#tab-daily',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  res.redirect('/portal/designer/projects/' + projectId + '#tab-daily');
});

function canEditQuotation(quotation) {
  return quotation && quotation.status !== 'APPROVED';
}

/** Finance is managed from the admin project screen only (not designer routes). */
function designerCanSeeFinance() {
  return false;
}

router.post('/designer/projects/:id/quotation/update', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'updates'))) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation || !canEditQuotation(quotation)) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=Quotation+locked#tab-updates');
  const base_total = parseFloat(req.body.base_total);
  if (Number.isNaN(base_total)) return res.redirect('/portal/designer/projects/' + req.params.id + '#tab-updates');
  let items = req.body.items;
  try { items = items ? JSON.parse(items) : quotation.items ? JSON.parse(quotation.items) : []; } catch (_) { items = []; }
  await portalDb.updateQuotation(quotation.id, { base_total, items: JSON.stringify(items) });
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-updates');
});

router.post('/designer/projects/:id/quotation/upload-pdf', requirePortalAuth, requireDesigner, portalUpload.single('pdf'), async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'updates'))) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  let quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation) {
    const qid = await portalDb.createQuotation(project.id, 0, []);
    quotation = await portalDb.getQuotationById(qid);
  }
  if (!req.file) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=Select+PDF#tab-updates');
  const pdfUrl = '/assets/uploads/portal/' + path.basename(req.file.filename);
  await portalDb.updateQuotation(quotation.id, { pdf_url: pdfUrl });
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-updates');
});

router.post('/designer/projects/:id/extra-cost', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'updates'))) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  const quotation = await portalDb.getLatestQuotationByProjectId(project.id);
  if (!quotation) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=No+quotation#tab-updates');
  const description = (req.body.description || '').trim();
  const amount = parseFloat(req.body.amount);
  if (!description || Number.isNaN(amount)) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=Description+and+amount+required#tab-updates');
  await portalDb.createExtraCost(quotation.id, description, amount, (req.body.comment || '').trim());
  res.redirect('/portal/designer/projects/' + req.params.id);
});

router.post('/designer/projects/:id/extra-cost/:ecId/respond', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'updates'))) return res.status(403).send('Forbidden');
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
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'updates'))) return res.status(403).send('Forbidden');
  if (!designerCanSeeFinance(project, req.session)) return res.status(403).send('Forbidden');
  const ec = await portalDb.getExtraCostById(req.params.ecId);
  if (!ec || ec.status === 'SUPERSEDED') return res.redirect('/portal/designer/projects/' + req.params.id);
  const q = await portalDb.getQuotationById(ec.quotation_id);
  if (!q || q.project_id !== project.id) return res.redirect('/portal/designer/projects/' + req.params.id);
  const description = (req.body.description || '').trim();
  const amount = parseFloat(req.body.amount);
  if (!description || Number.isNaN(amount)) return res.redirect('/portal/designer/projects/' + req.params.id + '?msg=Description+and+amount+required#tab-updates');
  await portalDb.createExtraCost(q.id, description, amount, (req.body.comment || '').trim(), ec.id);
  await portalDb.updateExtraCost(ec.id, { status: 'SUPERSEDED' });
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-updates');
});

// Designer: add new version to existing design (upload)
router.post('/designer/projects/:id/design/:designId/version', requirePortalAuth, requireDesigner, portalUpload.single('file'), async (req, res) => {
  const projectId = req.params.id;
  const project = await portalDb.getProjectById(projectId);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, projectId, 'vault'))) return res.status(403).send('Forbidden');
  const design = await portalDb.getDesignById(req.params.designId);
  if (!design || design.project_id !== projectId) return res.redirect('/portal/designer/projects/' + projectId + '#tab-vault');
  if (!req.file) return res.redirect('/portal/designer/projects/' + projectId + '?msg=No+file#tab-vault');
  const url = '/assets/uploads/portal/' + path.basename(req.file.filename);
  const mediaId = await portalDb.addProjectMedia(projectId, url, req.file.mimetype.startsWith('video') ? 'VIDEO' : 'PHOTO', design.category, req.file.originalname, req.file.size);
  // When a new version is created, do not auto-carry old 2D/3D links to this version.
  // Existing links are cleared so that designer/admin explicitly relink for the new version.
  await portalDb.clearDesignLinks(design.id);
  await portalDb.createDesignVersion(design.id, mediaId, req.session[PORTAL_USER_ID], 'PENDING_ADMIN', 'PENDING');
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DESIGN,
      message: `New design version uploaded on «${project.title}».`,
      projectId,
      tabSuffix: '#tab-vault',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
      includeClient: false,
    })
  );
  res.redirect('/portal/designer/projects/' + projectId + '#tab-vault');
});

router.post('/designer/projects/:id/design/:designId/delete', requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'vault'))) return res.status(403).send('Forbidden');
  const design = await portalDb.getDesignById(req.params.designId);
  if (!design || design.project_id !== req.params.id) return res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
  await portalDb.deleteDesign(design.id);
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

router.post('/designer/projects/:id/design-version/:versionId/comment', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
  const canAccess = (await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)) || req.session[PORTAL_USER_ROLE] === 'ADMIN';
  if (!canAccess) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'vault'))) return res.status(403).send('Forbidden');
  const message = (req.body.message || '').trim();
  if (version && message) {
    await portalDb.addDesignComment(version.id, 'DESIGNER', req.session[PORTAL_USER_ID], message);
    const clientSeesVersion = version && version.admin_status === 'APPROVED';
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.COMMENT,
        message: `New design comment from designer on «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-vault',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: clientSeesVersion,
      })
    );
  }
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

router.post('/designer/projects/:id/design-link', express.urlencoded({ extended: false }), requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'vault'))) return res.status(403).send('Forbidden');
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
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'vault'))) return res.status(403).send('Forbidden');
  await portalDb.removeDesignLink(req.params.linkId);
  res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
});

router.post('/designer/projects/:id/media/:mediaId/delete', requirePortalAuth, requireDesigner, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.id);
  if (!project || (req.session[PORTAL_USER_ROLE] !== 'ADMIN' && !(await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)))) return res.status(403).send('Forbidden');
  const row = await portalDb.get('SELECT category FROM portal_media WHERE id = ? AND project_id = ?', [
    req.params.mediaId,
    req.params.id,
  ]);
  const tabKey = row && row.category === 'MOOD_BOARD' ? 'mood-board' : 'vault';
  if (!(await assertDesignerTab(req, req.params.id, tabKey))) return res.status(403).send('Forbidden');
  await portalDb.deleteProjectMedia(req.params.id, req.params.mediaId);
  const hash = row && row.category === 'MOOD_BOARD' ? '#tab-mood-board' : '#tab-vault';
  res.redirect('/portal/designer/projects/' + req.params.id + hash);
});

router.post('/designer/projects/:id/design-version/:versionId/delete', requirePortalAuth, requireDesigner, async (req, res) => {
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/designer/projects/' + req.params.id + '#tab-vault');
  const canAccess = (await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id)) || req.session[PORTAL_USER_ROLE] === 'ADMIN';
  if (!canAccess) return res.status(403).send('Forbidden');
  if (!(await assertDesignerTab(req, req.params.id, 'vault'))) return res.status(403).send('Forbidden');
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
  (projects || []).forEach((p) => enrichProjectLifecycle(p));
  renderPortal(req, res, 'portal/client/dashboard', {
    projects,
    dvPoints: user?.dv_points_balance ?? 0,
    referrals: referrals || [],
    notifications: notifications || [],
    query: req.query,
  });
});

function parseClientPhonesFromBody(body) {
  const out = [];
  if (!body || typeof body !== 'object') return out;
  const raw = body.phones;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const keys = Object.keys(raw)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    for (const k of keys) {
      const item = raw[k];
      if (!item || typeof item !== 'object') continue;
      const num = String(item.number != null ? item.number : '').trim();
      if (!num) continue;
      out.push({ phone: num, label: String(item.label || 'Mobile').trim() || 'Mobile' });
    }
    return out.slice(0, 15);
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const num = String(item.number != null ? item.number : '').trim();
      if (!num) continue;
      out.push({ phone: num, label: String(item.label || 'Mobile').trim() || 'Mobile' });
    }
    return out.slice(0, 15);
  }
  return out;
}

router.get('/client/profile', requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') {
    return res.redirect('/portal/' + (req.session[PORTAL_USER_ROLE] === 'ADMIN' ? 'admin' : 'designer'));
  }
  const userId = req.session[PORTAL_USER_ID];
  const [user, profile, phones] = await Promise.all([
    portalDb.getUserById(userId),
    portalDb.getClientProfileForClient(userId),
    portalDb.getClientPhones(userId),
  ]);
  renderPortal(req, res, 'portal/client/profile', {
    title: 'My profile',
    user,
    profile,
    phones: phones || [],
    query: req.query,
  });
});

router.post('/client/profile', express.urlencoded({ extended: true }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const userId = req.session[PORTAL_USER_ID];
  const fullName = String(req.body.full_name || '').trim();
  if (fullName) {
    await portalDb.updateClientUserFullName(userId, fullName);
    req.session[PORTAL_USER_NAME] = fullName.slice(0, 500);
  }
  await portalDb.upsertClientProfile(userId, req.body);
  await portalDb.replaceClientPhones(userId, parseClientPhonesFromBody(req.body));
  req.session.save((err) => {
    if (err) console.error('portal profile session save:', err);
    res.redirect('/portal/client/profile?saved=1');
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
  const access = await requireClientProjectAccess(req, req.params.id, 'vault');
  if (!access) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  const { version, design, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  if (version && version.admin_status === 'APPROVED') await portalDb.updateDesignVersion(version.id, { client_status: 'APPROVED' });
  if (project && version && version.admin_status === 'APPROVED') {
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.DESIGN,
        message: `Client approved a design version on «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-vault',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
  res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
});

router.post('/client/projects/:id/design-version/:versionId/deny', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'vault');
  if (!access) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  const message = (req.body.reason || req.body.message || 'Denied by client').trim();
  if (version && version.admin_status === 'APPROVED') {
    await portalDb.updateDesignVersion(version.id, { client_status: 'DENIED' });
    if (message) await portalDb.addDesignComment(version.id, 'CLIENT', req.session[PORTAL_USER_ID], message);
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.DESIGN,
        message: `Client declined a design version on «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-vault',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
  res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
});

router.post('/client/projects/:id/design-version/:versionId/comment', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'vault');
  if (!access) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  const { version, project } = await getDesignVersionAndProject(req.params.versionId);
  if (!project || project.id !== req.params.id) return res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
  const message = (req.body.message || '').trim();
  if (version && version.admin_status === 'APPROVED' && message) {
    await portalDb.addDesignComment(version.id, 'CLIENT', req.session[PORTAL_USER_ID], message);
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.COMMENT,
        message: `Client commented on a design on «${project.title}».`,
        projectId: project.id,
        tabSuffix: '#tab-vault',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
  res.redirect('/portal/client/projects/' + req.params.id + '#tab-vault');
});

router.post('/client/projects/:id/material-selection/:matId/approve', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const projectId = req.params.id;
  const access = await requireClientProjectAccess(req, projectId, 'material-selection');
  const redir = '/portal/client/projects/' + projectId + '#tab-material-selection';
  if (!access) return res.redirect(redir);
  const mat = await portalDb.getMaterialSelectionById(req.params.matId);
  if (!mat || mat.project_id !== projectId) return res.redirect(redir);
  await portalDb.setMaterialSelectionClientStatus(projectId, req.params.matId, 'APPROVED', null);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DOCUMENTS,
      message: `Client approved material «${mat.material_code || 'item'}» (${mat.area_tag || 'General'}) on «${access.project.title}».`,
      projectId,
      tabSuffix: '#tab-material-selection',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(redir);
});

router.post('/client/projects/:id/material-selection/:matId/reject', express.urlencoded({ extended: true }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const projectId = req.params.id;
  const access = await requireClientProjectAccess(req, projectId, 'material-selection');
  const redir = '/portal/client/projects/' + projectId + '#tab-material-selection';
  if (!access) return res.redirect(redir);
  const mat = await portalDb.getMaterialSelectionById(req.params.matId);
  if (!mat || mat.project_id !== projectId) return res.redirect(redir);
  const note = (req.body && req.body.client_note) ? String(req.body.client_note).trim() : '';
  await portalDb.setMaterialSelectionClientStatus(projectId, req.params.matId, 'REJECTED', note || null);
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.DOCUMENTS,
      message: `Client rejected material «${mat.material_code || 'item'}» (${mat.area_tag || 'General'}) on «${access.project.title}».`,
      projectId,
      tabSuffix: '#tab-material-selection',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(redir);
});

router.get('/client/projects/:id/worksite', requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const ctx = await resolveProjectWorksiteAccess(req, req.params.id);
  if (!ctx) return res.status(403).send('Forbidden');
  return renderWorksitePage(req, res, ctx);
});

router.post(
  '/client/projects/:id/worksite',
  express.urlencoded({ extended: true }),
  requirePortalAuth,
  async (req, res) => {
    if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
    const ctx = await resolveProjectWorksiteAccess(req, req.params.id);
    if (!ctx) return res.status(403).send('Forbidden');
    return handleWorksitePost(req, res, ctx);
  }
);

router.get('/client/projects/:id', requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, null);
  if (!access) return res.status(403).send('Forbidden');
  const project = access.project;
  enrichProjectLifecycle(project);
  const clientAllowedTabs = clientTabVisibilityMap(access.allowedTabs);
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
  const siteLog = mediaList.filter((m) => m.category === 'SITE_LOG' && Number(m.approved) === 1);
  const byYearMonth = groupMediaByDate(siteLog);
  // Client sees only admin-approved site log & official docs; 2D/3D only via approved design versions
  const mediaByCategory = {
    ARCHITECTURAL_PLANS: [],
    VISUALIZATIONS: [],
    SITE_LOG: siteLog,
    OFFICIAL_DOCS: mediaList.filter((m) => m.category === 'OFFICIAL_DOCS' && Number(m.approved) === 1),
  };
  const vaultMediaList = buildVaultMediaList(
    mediaList.filter(
      (m) =>
        m.category !== 'ARCHITECTURAL_PLANS' &&
        m.category !== 'VISUALIZATIONS' &&
        ((m.category === 'SITE_LOG' || m.category === 'OFFICIAL_DOCS') && Number(m.approved) === 1)
    )
  );
  const dailyUpdatesRaw = await portalDb.getDailyUpdatesByProject(project.id);
  const dailyUpdates = (dailyUpdatesRaw || []).filter((u) => Number(u.visible_to_client) === 1);
  const projectDesigns = await portalDb.getDesignsForProjectWithDetails(project.id, { forClient: true });
  const warrantyDocs = mediaList.filter((m) => m.category === 'WARRANTY_GUARANTEE' && m.approved === 1);
  const vastuDocs = mediaList.filter((m) => m.category === 'VASTU' && m.approved === 1);
  const otherDocs = mediaList.filter((m) => m.category === 'OTHER_DOCS' && m.approved === 1);
  const moodBoardFiles = mediaList.filter((m) => m.category === 'MOOD_BOARD' && Number(m.approved) === 1);
  const timelineExtensionsRaw = await portalDb.getTimelineExtensions(project.id);
  const timelineExtensions = (timelineExtensionsRaw || []).filter(
    (e) =>
      e.status === 'APPROVED' &&
      ((e.phase === 'DESIGN' && Number(project.design_timeline_visible_to_client) === 1) ||
        (e.phase === 'EXECUTION' && Number(project.execution_timeline_visible_to_client) === 1))
  );
  const clientPaymentsAll = await portalDb.getClientPaymentsByProject(project.id);
  const clientPaymentsPublished = (clientPaymentsAll || []).filter((p) => Number(p.approved_for_client) === 1);
  const financePaidPublished = sumApprovedClientPayments(clientPaymentsAll);
  const financeBalanceDue = balanceDueAfterPublishedPayments(total, clientPaymentsAll);
  const paymentTerms = parsePaymentTermsJson(project.payment_terms_json);
  const quotationBaseForTerms =
    quotation && quotation.status === 'APPROVED' ? Number(quotation.base_total) || 0 : 0;
  const paymentScheduleProgress = buildPaymentScheduleViewForProject(project, quotation, extraCosts, clientPaymentsAll);
  const materialSelections = await portalDb.getMaterialSelectionsForProject(project.id);
  const projectMessagesRaw = await portalDb.getProjectMessages(project.id);
  const projectMessageThreads = groupPortalProjectMessages(projectMessagesRaw);
  const clientMessageAlerts = await portalDb.getClientHighlightMessages(project.id);
  const projectMeetings = enrichProjectMeetingsList(await portalDb.getProjectMeetings(project.id));
  const [designIdeaAreas, designIdeasWithComments] = await Promise.all([
    portalDb.listDesignIdeaAreasForProject(project.id),
    portalDb.listDesignIdeasWithCommentsForProject(project.id),
  ]);
  renderPortal(req, res, 'portal/client/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    financePaidPublished,
    financeBalanceDue,
    clientPayments: clientPaymentsPublished,
    media: mediaList,
    byYearMonth,
    mediaByCategory,
    vaultMediaList,
    dailyUpdates: dailyUpdates || [],
    projectDesigns,
    warrantyDocs,
    vastuDocs,
    otherDocs,
    moodBoardFiles,
    timelineExtensions,
    readOnly: false,
    paymentTerms,
    quotationBaseForTerms,
    paymentScheduleProgress,
    clientAllowedTabs,
    materialSelections: materialSelections || [],
    projectMessageThreads,
    clientMessageAlerts: clientMessageAlerts || [],
    messagePriorities: portalDb.MESSAGE_PRIORITY_LEVELS,
    projectMeetings,
    query: req.query,
    designIdeaAreas: designIdeaAreas || [],
    designIdeasWithComments: designIdeasWithComments || [],
  });
});

router.post('/client/projects/:id/messages', express.urlencoded({ extended: true }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'messages');
  if (!access) return res.status(403).send('Forbidden');
  const projectId = req.params.id;
  const body = String(req.body.body || '').trim();
  if (!body) return res.redirect('/portal/client/projects/' + projectId + '#tab-messages');
  try {
    await portalDb.createProjectMessage(projectId, req.session[PORTAL_USER_ID], 'CLIENT', body, {});
  } catch (_e) {
    return res.redirect('/portal/client/projects/' + projectId + '#tab-messages');
  }
  const proj = access.project;
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MESSAGE,
      message: `Client sent a message on «${proj.title}».`,
      projectId,
      tabSuffix: '#tab-messages',
      includeClient: false,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/client/projects/' + projectId + '#tab-messages');
});

router.post('/client/projects/:id/messages/:msgId/reply', express.urlencoded({ extended: true }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'messages');
  if (!access) return res.status(403).send('Forbidden');
  const projectId = req.params.id;
  const parentId = req.params.msgId;
  const parent = await portalDb.getProjectMessageById(parentId, projectId);
  if (!parent) return res.redirect('/portal/client/projects/' + projectId + '#tab-messages');
  const body = String(req.body.body || '').trim();
  if (!body) return res.redirect('/portal/client/projects/' + projectId + '#tab-messages');
  try {
    await portalDb.createProjectMessage(projectId, req.session[PORTAL_USER_ID], 'CLIENT', body, { parentId });
  } catch (_e) {
    return res.redirect('/portal/client/projects/' + projectId + '#tab-messages');
  }
  const proj = access.project;
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MESSAGE,
      message: `Client replied on messages for «${proj.title}».`,
      projectId,
      tabSuffix: '#tab-messages',
      includeClient: false,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect('/portal/client/projects/' + projectId + '#tab-messages');
});

router.post('/client/projects/:id/messages/:msgId/ack', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'messages');
  if (!access) return res.status(403).send('Forbidden');
  await portalDb.acknowledgeStaffMessageForClient(req.params.msgId, req.params.id);
  res.redirect('/portal/client/projects/' + req.params.id + '#tab-messages');
});

router.post('/client/projects/:id/meetings/propose', express.urlencoded({ extended: true }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'meetings');
  if (!access) return res.status(403).send('Forbidden');
  const projectId = req.params.id;
  const redir = '/portal/client/projects/' + projectId + MEETING_TAB;
  const slot = portalMeet.parseStartAndDuration(req.body.start_at, req.body.duration_minutes);
  if (!slot) return res.redirect(redir + '?meet_err=invalid_time');
  const title = (String(req.body.title || '').trim().slice(0, 500) || 'Meeting request');
  const notes = String(req.body.notes || '').trim().slice(0, 2000);
  if ((await portalDb.countOverlappingMeetings(projectId, slot.startIso, slot.endIso)) > 0) {
    return res.redirect(redir + '?meet_err=overlap');
  }
  const uid = req.session[PORTAL_USER_ID];
  await portalDb.createProjectMeeting({
    projectId,
    title,
    startIso: slot.startIso,
    endIso: slot.endIso,
    meetLink: '',
    proposedByUserId: uid,
    proposedByRole: 'CLIENT',
    status: portalDb.MEETING_STATUS.PENDING_STAFF,
    awaitingParty: 'STAFF',
    notes,
  });
  const proj = access.project;
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: `The client requested a meeting on «${proj.title}»: ${title}. Open Meetings to confirm with a Google Meet link or decline.`,
      projectId,
      tabSuffix: MEETING_TAB,
      includeClient: false,
      excludeUserIds: [uid],
    })
  );
  res.redirect(redir);
});

router.post('/client/projects/:id/meetings/:mid/accept', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'meetings');
  if (!access) return res.status(403).send('Forbidden');
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/client/projects/' + projectId + MEETING_TAB;
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.status !== portalDb.MEETING_STATUS.PENDING_CLIENT) return res.redirect(redir);
  await portalDb.updateMeetingStatus(projectId, mid, {
    status: portalDb.MEETING_STATUS.CONFIRMED,
    respondedByUserId: req.session[PORTAL_USER_ID],
  });
  const link = (m.meet_link || '').trim();
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: `The client accepted the meeting on «${access.project.title}»: ${m.title}.${link ? ` Link: ${link}` : ''}`,
      projectId,
      tabSuffix: MEETING_TAB,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(redir);
});

router.post('/client/projects/:id/meetings/:mid/decline', express.urlencoded({ extended: true }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'meetings');
  if (!access) return res.status(403).send('Forbidden');
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/client/projects/' + projectId + MEETING_TAB;
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.status !== portalDb.MEETING_STATUS.PENDING_CLIENT) return res.redirect(redir);
  await portalDb.updateMeetingStatus(projectId, mid, {
    status: portalDb.MEETING_STATUS.DECLINED,
    respondedByUserId: req.session[PORTAL_USER_ID],
    declineReason: String(req.body.decline_reason || '').trim(),
  });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.MEETING,
      message: `The client declined a proposed meeting on «${access.project.title}»: ${m.title}.`,
      projectId,
      tabSuffix: MEETING_TAB,
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.redirect(redir);
});

router.post('/client/projects/:id/meetings/:mid/cancel', express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
  const access = await requireClientProjectAccess(req, req.params.id, 'meetings');
  if (!access) return res.status(403).send('Forbidden');
  const projectId = req.params.id;
  const mid = req.params.mid;
  const redir = '/portal/client/projects/' + projectId + MEETING_TAB;
  const m = await portalDb.getProjectMeetingById(mid, projectId);
  if (!m || m.proposed_by_user_id !== req.session[PORTAL_USER_ID]) return res.redirect(redir);
  if (m.status !== portalDb.MEETING_STATUS.PENDING_CLIENT && m.status !== portalDb.MEETING_STATUS.PENDING_STAFF) {
    return res.redirect(redir);
  }
  await portalDb.updateMeetingStatus(projectId, mid, { status: portalDb.MEETING_STATUS.CANCELLED });
  res.redirect(redir);
});

router.post(
  '/client/projects/:id/design-ideas',
  requirePortalAuth,
  (req, res, next) => {
    ideaUpload.single('file')(req, res, (err) => {
      if (err) {
        return res.redirect(
          '/portal/client/projects/' +
            req.params.id +
            '?msg=' +
            encodeURIComponent(
              err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 25 MB).' : 'Upload failed.'
            ) +
            '#tab-design-ideas'
        );
      }
      next();
    });
  },
  async (req, res) => {
    if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
    const projectId = req.params.id;
    const access = await requireClientProjectAccess(req, projectId, 'design-ideas');
    if (!access) return res.status(403).send('Forbidden');
    const title = String(req.body.title || '').trim();
    const noteText = String(req.body.note_text || '').trim();
    const linkUrl = normalizeClientIdeaLink(req.body.link_url);
    let filePath = null;
    let fileName = null;
    let fileType = 'NONE';
    if (req.file) {
      if (!clientIdeaUploadAllowed(req.file)) {
        const fp = req.file.path;
        if (fp) fs.unlink(fp, () => {});
        return res.redirect(
          '/portal/client/projects/' + projectId + '?msg=' + encodeURIComponent('That file type is not supported.') + '#tab-design-ideas'
        );
      }
      filePath = '/assets/uploads/portal/' + path.basename(req.file.filename);
      fileName = req.file.originalname;
      fileType = inferPortalUploadMediaType(req.file);
    }
    let areaId = null;
    const newAreaCustom = String(req.body.new_area_name || '').trim();
    const areaChoice = String(req.body.area_choice || '').trim();
    if (newAreaCustom) {
      areaId = await portalDb.addDesignIdeaAreaForProject(projectId, newAreaCustom);
    } else if (areaChoice.startsWith('id:')) {
      const aid = areaChoice.slice(3).trim();
      if (aid) {
        const row = await portalDb.getDesignIdeaAreaInProject(aid, projectId);
        if (row) areaId = row.id;
      }
    } else if (areaChoice.startsWith('new:')) {
      const presetName = areaChoice.slice(4).trim();
      if (presetName) areaId = await portalDb.addDesignIdeaAreaForProject(projectId, presetName);
    }
    const hasContent =
      (title && title.length > 0) ||
      (noteText && noteText.length > 0) ||
      (linkUrl && linkUrl.length > 0) ||
      !!filePath;
    if (!hasContent) {
      if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
      return res.redirect(
        '/portal/client/projects/' +
          projectId +
          '?msg=' +
          encodeURIComponent('Add a title, note, link, or attachment.') +
          '#tab-design-ideas'
      );
    }
    await portalDb.createDesignIdea(projectId, req.session[PORTAL_USER_ID], {
      areaId,
      title,
      noteText,
      linkUrl,
      filePath,
      fileName,
      fileType,
    });
    const proj = access.project;
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.DESIGN,
        message: `New client inspiration was shared on «${proj.title}».`,
        projectId,
        tabSuffix: '#tab-design-ideas',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: false,
      })
    );
    res.redirect('/portal/client/projects/' + projectId + '#tab-design-ideas');
  }
);

router.post(
  '/client/projects/:id/design-ideas/:ideaId/comment',
  express.urlencoded({ extended: true }),
  requirePortalAuth,
  async (req, res) => {
    if (req.session[PORTAL_USER_ROLE] !== 'CLIENT') return res.status(403).send('Forbidden');
    const projectId = req.params.id;
    const ideaId = req.params.ideaId;
    const access = await requireClientProjectAccess(req, projectId, 'design-ideas');
    if (!access) return res.status(403).send('Forbidden');
    const body = String(req.body.body || '').trim();
    if (!body) return res.redirect('/portal/client/projects/' + projectId + '#idea-' + ideaId);
    const idea = await portalDb.getDesignIdeaByIdInProject(ideaId, projectId);
    if (!idea) return res.status(404).send('Not found');
    await portalDb.addDesignIdeaComment(ideaId, req.session[PORTAL_USER_ID], body);
    const proj = access.project;
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.COMMENT,
        message: `The client replied on a design inspiration for «${proj.title}».`,
        projectId,
        tabSuffix: '#tab-design-ideas',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
        includeClient: false,
      })
    );
    res.redirect('/portal/client/projects/' + projectId + '#idea-' + ideaId);
  }
);

// ----- Mirror Mode (Admin/Designer view as client) -----
router.get('/mirror/:projectId', requirePortalAuth, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.projectId);
  if (!project) return res.status(404).send('Project not found');
  enrichProjectLifecycle(project);
  const isAdmin = req.session[PORTAL_USER_ROLE] === 'ADMIN';
  const isAssignedDesigner = await portalDb.designerHasProjectAccess(req.session[PORTAL_USER_ID], project.id);
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
  const siteLog = mediaList.filter((m) => m.category === 'SITE_LOG' && Number(m.approved) === 1);
  const byYearMonth = groupMediaByDate(siteLog);
  const mediaByCategory = {
    ARCHITECTURAL_PLANS: [],
    VISUALIZATIONS: [],
    SITE_LOG: siteLog,
    OFFICIAL_DOCS: mediaList.filter((m) => m.category === 'OFFICIAL_DOCS' && Number(m.approved) === 1),
  };
  const vaultMediaList = buildVaultMediaList(
    mediaList.filter(
      (m) =>
        m.category !== 'ARCHITECTURAL_PLANS' &&
        m.category !== 'VISUALIZATIONS' &&
        ((m.category === 'SITE_LOG' || m.category === 'OFFICIAL_DOCS') && Number(m.approved) === 1)
    )
  );
  const dailyUpdatesRawM = await portalDb.getDailyUpdatesByProject(project.id);
  const dailyUpdates = (dailyUpdatesRawM || []).filter((u) => Number(u.visible_to_client) === 1);
  const projectDesigns = await portalDb.getDesignsForProjectWithDetails(project.id, { forClient: true });
  const warrantyDocs = mediaList.filter((m) => m.category === 'WARRANTY_GUARANTEE' && m.approved === 1);
  const vastuDocs = mediaList.filter((m) => m.category === 'VASTU' && m.approved === 1);
  const otherDocs = mediaList.filter((m) => m.category === 'OTHER_DOCS' && m.approved === 1);
  const moodBoardFiles = mediaList.filter((m) => m.category === 'MOOD_BOARD' && Number(m.approved) === 1);
  const timelineExtensionsRaw = await portalDb.getTimelineExtensions(project.id);
  const timelineExtensions = (timelineExtensionsRaw || []).filter(
    (e) =>
      e.status === 'APPROVED' &&
      ((e.phase === 'DESIGN' && Number(project.design_timeline_visible_to_client) === 1) ||
        (e.phase === 'EXECUTION' && Number(project.execution_timeline_visible_to_client) === 1))
  );
  const clientPaymentsAll = await portalDb.getClientPaymentsByProject(project.id);
  const clientPaymentsPublished = (clientPaymentsAll || []).filter((p) => Number(p.approved_for_client) === 1);
  const financePaidPublished = sumApprovedClientPayments(clientPaymentsAll);
  const financeBalanceDue = balanceDueAfterPublishedPayments(total, clientPaymentsAll);
  const paymentTerms = parsePaymentTermsJson(project.payment_terms_json);
  const quotationBaseForTerms =
    quotation && quotation.status === 'APPROVED' ? Number(quotation.base_total) || 0 : 0;
  const paymentScheduleProgress = buildPaymentScheduleViewForProject(project, quotation, extraCosts, clientPaymentsAll);
  const materialSelections = await portalDb.getMaterialSelectionsForProject(project.id);
  const projectMessagesRaw = await portalDb.getProjectMessages(project.id);
  const projectMessageThreads = groupPortalProjectMessages(projectMessagesRaw);
  const clientMessageAlerts = await portalDb.getClientHighlightMessages(project.id);
  const projectMeetings = enrichProjectMeetingsList(await portalDb.getProjectMeetings(project.id));
  const [designIdeaAreas, designIdeasWithComments] = await Promise.all([
    portalDb.listDesignIdeaAreasForProject(project.id),
    portalDb.listDesignIdeasWithCommentsForProject(project.id),
  ]);
  res.locals.mirrorBanner = true;
  renderPortal(req, res, 'portal/client/project_detail', {
    project,
    quotation,
    extraCosts,
    total,
    financePaidPublished,
    financeBalanceDue,
    clientPayments: clientPaymentsPublished,
    media: mediaList,
    byYearMonth,
    mediaByCategory,
    vaultMediaList,
    dailyUpdates: dailyUpdates || [],
    projectDesigns,
    warrantyDocs,
    vastuDocs,
    otherDocs,
    moodBoardFiles,
    timelineExtensions,
    readOnly: true,
    paymentTerms,
    quotationBaseForTerms,
    paymentScheduleProgress,
    clientAllowedTabs: allClientTabsVisibleMap(),
    materialSelections: materialSelections || [],
    projectMessageThreads,
    clientMessageAlerts: clientMessageAlerts || [],
    messagePriorities: portalDb.MESSAGE_PRIORITY_LEVELS,
    projectMeetings,
    query: req.query,
    designIdeaAreas: designIdeaAreas || [],
    designIdeasWithComments: designIdeasWithComments || [],
  });
});

// ----- API: Quotation total (for live updates) -----
router.get('/api/quotation/:projectId/total', requirePortalAuth, async (req, res) => {
  const project = await portalDb.getProjectById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  let canAccess = req.session[PORTAL_USER_ROLE] === 'ADMIN';
  if (!canAccess && req.session[PORTAL_USER_ROLE] === 'CLIENT') {
    const acc = await portalDb.getClientProjectPortalAccess(req.session[PORTAL_USER_ID], req.params.projectId);
    canAccess = !!(acc && acc.allowedTabs.has('finance'));
  }
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
  const acc = await requireClientProjectAccess(req, q.project_id, 'finance');
  if (!project || !acc) return res.status(403).json({ error: 'Forbidden' });
  await portalDb.updateQuotation(req.params.id, { status: 'APPROVED' });
  const extraCostsAfter = await portalDb.getExtraCostsByQuotationId(q.id);
  const sched = buildPaymentScheduleViewForProject(project, q, extraCostsAfter, await portalDb.getClientPaymentsByProject(project.id));
  const fp = fingerprintPaymentSchedule(sched);
  await portalDb.updateProject(project.id, { payment_schedule_notify_fingerprint: fp });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: `Client approved the quotation for «${project.title}». ${buildPaymentScheduleShortLine(sched)}`,
      projectId: project.id,
      tabSuffix: '#tab-finance',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.json({ ok: true });
});

router.post('/api/extra-cost/:id/approve', requirePortalAuth, async (req, res) => {
  const ec = await portalDb.getExtraCostById(req.params.id);
  if (!ec) return res.status(404).json({ error: 'Not found' });
  const q = await portalDb.getQuotationById(ec.quotation_id);
  const project = await portalDb.getProjectById(q.project_id);
  const acc = await requireClientProjectAccess(req, q.project_id, 'finance');
  if (!project || !acc) return res.status(403).json({ error: 'Forbidden' });
  await portalDb.updateExtraCost(req.params.id, { status: 'APPROVED' });
  const extraCostsAfter = await portalDb.getExtraCostsByQuotationId(q.id);
  const sched = buildPaymentScheduleViewForProject(project, q, extraCostsAfter, await portalDb.getClientPaymentsByProject(project.id));
  const fp = fingerprintPaymentSchedule(sched);
  await portalDb.updateProject(project.id, { payment_schedule_notify_fingerprint: fp });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: `Client approved an extra cost on «${project.title}». ${buildPaymentScheduleShortLine(sched)}`,
      projectId: project.id,
      tabSuffix: '#tab-finance',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.json({ ok: true });
});

router.post('/api/extra-cost/:id/reject', express.json(), express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  const ec = await portalDb.getExtraCostById(req.params.id);
  if (!ec) return res.status(404).json({ error: 'Not found' });
  const q = await portalDb.getQuotationById(ec.quotation_id);
  const project = await portalDb.getProjectById(q.project_id);
  const acc = await requireClientProjectAccess(req, q.project_id, 'finance');
  if (!project || !acc) return res.status(403).json({ error: 'Forbidden' });
  const reason = (req.body && (req.body.reason || req.body.rejection_reason)) ? String(req.body.reason || req.body.rejection_reason).trim() : '';
  if (!reason) return res.status(400).json({ error: 'Reason for rejection is required' });
  await portalDb.updateExtraCost(req.params.id, { status: 'REJECTED', client_note: reason });
  portalNotify.safeNotify(
    portalNotify.notifyProjectStakeholders(portalDb, {
      category: NC.FINANCE,
      message: `Client rejected an extra cost on «${project.title}».`,
      projectId: project.id,
      tabSuffix: '#tab-finance',
      excludeUserIds: [req.session[PORTAL_USER_ID]],
    })
  );
  res.json({ ok: true });
});

router.post('/api/extra-cost/:id/comment', express.json(), express.urlencoded({ extended: false }), requirePortalAuth, async (req, res) => {
  const ec = await portalDb.getExtraCostById(req.params.id);
  if (!ec) return res.status(404).json({ error: 'Not found' });
  const q = await portalDb.getQuotationById(ec.quotation_id);
  const project = await portalDb.getProjectById(q.project_id);
  const acc = await requireClientProjectAccess(req, q.project_id, 'finance');
  if (!project || !acc) return res.status(403).json({ error: 'Forbidden' });
  const comment = req.body && req.body.comment != null ? String(req.body.comment).trim() : '';
  if (comment) {
    await portalDb.addExtraCostComment(req.params.id, 'CLIENT', req.session[PORTAL_USER_ID], comment);
    const msg = `Client commented on a variation for «${project.title}».`;
    portalNotify.safeNotify(
      portalNotify.notifyProjectStakeholders(portalDb, {
        category: NC.COMMENT,
        message: msg,
        projectId: project.id,
        tabSuffix: '#tab-finance',
        excludeUserIds: [req.session[PORTAL_USER_ID]],
      })
    );
  }
  res.json({ ok: true });
});

module.exports = router;
