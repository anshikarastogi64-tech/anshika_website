require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const ejs = require('ejs');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const { db, getBlock, getBlocksForHome, saveBlock, incrementVisitCount, getVisitCount } = require('./db');
const {
  seoForPath,
  forPortfolioProject,
  forTestimonialDetail,
  forRecording,
  buildSitemapXml,
  publicBaseUrl,
} = require('./lib/seo');

const app = express();
const PORT = process.env.PORT || 8000;

const UPLOADS_DIR = path.join(__dirname, 'Kelly', 'assets', 'uploads');
const RECORDINGS_DIR = path.join(UPLOADS_DIR, 'recordings');
const WOMENS_DAY_DIR = path.join(UPLOADS_DIR, 'womens-day');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
if (!fs.existsSync(WOMENS_DAY_DIR)) fs.mkdirSync(WOMENS_DAY_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + (file.originalname || 'image').replace(/\s/g, '-')),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const recordingsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RECORDINGS_DIR),
  filename: (req, file, cb) => {
    const slug = crypto.randomBytes(8).toString('hex');
    const ext = (path.extname(file.originalname || '') || '.mp3').toLowerCase();
    cb(null, slug + ext);
  },
});
const uploadAudio = multer({ storage: recordingsStorage, limits: { fileSize: 50 * 1024 * 1024 } });

const womensDayStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, WOMENS_DAY_DIR),
  filename: (req, file, cb) => cb(null, 'wd_' + Date.now() + '-' + (file.originalname || 'image').replace(/\s/g, '-')),
});
const uploadWomensDay = multer({ storage: womensDayStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Trust proxy when behind nginx/ALB on EC2
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

/** Cookie secure: true only over HTTPS. Duplicate SESSION_SECURE lines in .env → last wins (can break local HTTP login). */
const sessionCookieSecure =
  process.env.SESSION_SECURE === 'true' ? true : process.env.SESSION_SECURE === 'false' ? false : 'auto';

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'designers-vision-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: sessionCookieSecure },
  })
);

// Static files for uploads
app.use('/assets/uploads', express.static(path.join(__dirname, 'Kelly', 'assets', 'uploads')));
app.use('/assets/uploads/portal', express.static(path.join(__dirname, 'Kelly', 'assets', 'uploads', 'portal')));
app.use('/assets', express.static(path.join(__dirname, 'Kelly', 'assets')));

app.use((req, res, next) => {
  res.locals.isAdmin = !!req.session.adminId;
  res.locals.adminUsername = req.session.adminUsername || '';
  next();
});

app.use((req, res, next) => {
  res.locals.seo = seoForPath(req.path, publicBaseUrl(req));
  next();
});

// Luxury Interior Portal (from md files specs)
const portalRouter = require('./routes/portal');

// Explicit portal routes so "new" and "refer" are never matched as :id (fixes 404 on some setups)
function forwardPortal(req, res, next, subPath) {
  const savedUrl = req.url;
  const savedPath = req.path;
  req.url = subPath;
  req.path = subPath;
  portalRouter(req, res, (err) => {
    req.url = savedUrl;
    req.path = savedPath;
    next(err);
  });
}
app.get('/portal/admin/leads/new', (req, res, next) => forwardPortal(req, res, next, '/admin/leads/new'));
app.get('/portal/admin/projects/new', (req, res, next) => forwardPortal(req, res, next, '/admin/projects/new'));
app.get('/portal/client/refer', (req, res, next) => forwardPortal(req, res, next, '/client/refer'));

app.use('/portal', portalRouter);

// Count public page visits (GET only, exclude admin & static)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const p = req.path;
  if (p.startsWith('/admin') || p.startsWith('/assets') || p === '/favicon.ico') return next();
  incrementVisitCount().catch(() => {}).finally(() => next());
});

function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.redirect('/admin/login');
  }
  next();
}

// Audio Recordings - must be first admin route (Express 5 routing)
function renderRecordingsPage(res, req, recordings, message, error) {
  ejs.renderFile(
    path.join(__dirname, 'views', 'admin', '_recordings_body.ejs'),
    { recordings, message: message || '', error: error || '' }
  ).then(bodyHtml => {
    res.render('admin/recordings', { body: bodyHtml });
  }).catch(e => {
    console.error('Recordings render error:', e);
    res.status(500).send('Error rendering page');
  });
}

app.get('/admin/recordings', requireAdmin, (req, res) => {
  db.all('SELECT id, slug, title, file_path, COALESCE(view_count, 0) AS view_count, created_at FROM audio_recordings ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error: ' + err.message);
    const baseUrl = req.protocol + '://' + req.get('host');
    const recordings = (rows || []).map(r => ({
      ...r,
      listenUrl: baseUrl + '/recording/' + r.slug,
      qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(baseUrl + '/recording/' + r.slug) + '&color=723d46&bgcolor=fce4ec&margin=10',
    }));
    renderRecordingsPage(res, req, recordings, '', '');
  });
});

app.get('/admin/recordings/', (req, res) => res.redirect(301, '/admin/recordings'));

app.get('/recording/:slug', (req, res) => {
  const slug = req.params.slug;
  db.get('SELECT id, slug, title, file_path FROM audio_recordings WHERE slug = ?', [slug], (err, row) => {
    if (err || !row) return res.status(404).send('Recording not found');
    db.run('UPDATE audio_recordings SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?', [row.id], (updateErr) => {
      if (updateErr) console.error('View count update error:', updateErr);
      res.locals.seo = forRecording(res.locals.seo, row, publicBaseUrl(req));
      res.render('recording', { recording: row });
    });
  });
});

app.get('/', async (req, res) => {
  const [hero, footerName] = await Promise.all([
    getBlocksForHome(),
    getBlock('global', 'footer', 'owner_name', 'Anshika Rastogi'),
  ]);
  res.render('index', { hero, footerName });
});

app.get('/about', (req, res) => res.redirect(301, '/about-new'));

app.get('/about-new', async (req, res) => {
  const title = await getBlock('about', 'intro', 'title', 'About');
  const paragraph = await getBlock(
    'about',
    'intro',
    'paragraph',
    'Interior design is the art and science of enhancing interior spaces to achieve a more aesthetically pleasing and functional environment.'
  );
  const footerName = await getBlock('global', 'footer', 'owner_name', 'Anshika Rastogi');
  db.get('SELECT id, name, city, initial_text, cover_image_path FROM portfolio_projects WHERE cover_image_path IS NOT NULL AND cover_image_path != ? ORDER BY sort_order ASC, id ASC LIMIT 1', [''], async (err, row) => {
    const contentData = {
      aboutIntro: { title, paragraph },
      featuredProject: !err && row ? row : null,
    };
    try {
      const body = await ejs.renderFile(
        path.join(__dirname, 'views', 'partials', 'about-new-content.ejs'),
        contentData
      );
      res.render('about-new', { footerName, body, active: 'about' });
    } catch (e) {
      console.error('About render error:', e);
      res.status(500).send('Error rendering page');
    }
  });
});

app.get('/testimonials', async (req, res) => {
  const [footerName, testimonials] = await Promise.all([
    getBlock('global', 'footer', 'owner_name', 'Anshika Rastogi'),
    new Promise((resolve) => {
      db.all("SELECT id, name, role, message, image_path, rating FROM testimonials WHERE status = 'approved' ORDER BY sort_order ASC, id ASC", (err, rows) => resolve(err ? [] : rows || []));
    }),
  ]);
  let mediaByTestimonial = {};
  if (testimonials.length > 0) {
    const ids = testimonials.map(t => t.id).join(',');
    const mediaRows = await new Promise((resolve) => {
      db.all('SELECT testimonial_id, type, path, sort_order FROM testimonial_media WHERE testimonial_id IN (' + ids + ') ORDER BY testimonial_id, sort_order ASC', (err, rows) => resolve(err ? [] : rows || []));
    });
    mediaRows.forEach(m => {
      if (!mediaByTestimonial[m.testimonial_id]) mediaByTestimonial[m.testimonial_id] = [];
      mediaByTestimonial[m.testimonial_id].push(m);
    });
  }
  try {
    const body = await ejs.renderFile(path.join(__dirname, 'views', 'partials', 'testimonials-content.ejs'), { testimonials, mediaByTestimonial });
    res.render('testimonials', { footerName, body });
  } catch (e) {
    console.error('Testimonials render error:', e);
    res.status(500).send('Error');
  }
});

app.get('/testimonials/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [footerName, testimonial, testimonialMedia] = await Promise.all([
    getBlock('global', 'footer', 'owner_name', 'Anshika Rastogi'),
    new Promise((resolve) => {
      db.get("SELECT id, name, role, message, image_path, rating FROM testimonials WHERE id = ? AND status = 'approved'", [id], (err, row) => resolve(err ? null : row));
    }),
    new Promise((resolve) => {
      db.all('SELECT id, type, path, sort_order FROM testimonial_media WHERE testimonial_id = ? ORDER BY sort_order ASC, id ASC', [id], (err, rows) => resolve(err ? [] : rows || []));
    }),
  ]);
  if (!testimonial) return res.status(404).send('Testimonial not found');
  try {
    res.locals.seo = forTestimonialDetail(res.locals.seo, testimonial, publicBaseUrl(req));
    const body = await ejs.renderFile(path.join(__dirname, 'views', 'partials', 'testimonial-detail.ejs'), { testimonial, testimonialMedia });
    res.render('testimonials', { footerName, body, active: 'testimonials' });
  } catch (e) {
    console.error('Testimonial detail render:', e);
    res.status(500).send('Error');
  }
});

app.get('/experience', async (req, res) => {
  const footerName = await getBlock(
    'global',
    'footer',
    'owner_name',
    'Anshika'
  );
  res.render('experience', { footerName });
});

app.get('/services', async (req, res) => {
  const [footerName, dbServices] = await Promise.all([
    getBlock('global', 'footer', 'owner_name', 'Anshika Rastogi'),
    new Promise((resolve) => {
      db.all('SELECT id, title, image_path FROM services ORDER BY sort_order ASC, id ASC', (err, rows) => resolve(err ? [] : rows || []));
    }),
  ]);
  let services = (dbServices && dbServices.length) ? dbServices : [];
  if (services.length === 0) {
    const { services: seedServices } = require('./seed-data');
    services = seedServices.map((s, i) => ({ id: i + 1, title: s.title, image_path: s.image_path || '' }));
  }
  res.render('services', {
    active: 'services',
    footerName,
    contentView: 'services-content',
    contentData: { services },
  });
});

app.get('/portfolio', async (req, res) => {
  const [footerName, categories, projects] = await Promise.all([
    getBlock('global', 'footer', 'owner_name', 'Anshika Rastogi'),
    new Promise((resolve) => {
      db.all('SELECT id, name, sort_order FROM portfolio_categories ORDER BY sort_order ASC, id ASC', (err, rows) => resolve(err ? [] : rows || []));
    }),
    new Promise((resolve) => {
      db.all('SELECT id, category_id, name, location, city, initial_text, cover_image_path FROM portfolio_projects ORDER BY category_id, sort_order ASC, id ASC', (err, rows) => resolve(err ? [] : rows || []));
    }),
  ]);
  try {
    const body = await ejs.renderFile(path.join(__dirname, 'views', 'partials', 'portfolio-content.ejs'), { categories, projects });
    res.render('portfolio', { footerName, body });
  } catch (e) {
    console.error('Portfolio render error:', e);
    res.status(500).send('Error rendering page');
  }
});

app.get('/portfolio/project/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [footerName, project, projectMedia, projectTestimonials] = await Promise.all([
    getBlock('global', 'footer', 'owner_name', 'Anshika Rastogi'),
    new Promise((resolve) => {
      db.get('SELECT p.id, p.name, p.location, p.city, p.initial_text, p.cover_image_path, p.details, c.name AS category_name FROM portfolio_projects p LEFT JOIN portfolio_categories c ON p.category_id = c.id WHERE p.id = ?', [id], (err, row) => resolve(err ? null : row));
    }),
    new Promise((resolve) => {
      db.all('SELECT id, type, path, sort_order FROM project_media WHERE project_id = ? ORDER BY sort_order ASC, id ASC', [id], (err, rows) => resolve(err ? [] : rows || []));
    }),
    new Promise((resolve) => {
      db.all("SELECT t.id, t.name, t.role, t.message, t.image_path FROM testimonials t INNER JOIN project_testimonials pt ON t.id = pt.testimonial_id WHERE pt.project_id = ? AND t.status = 'approved' ORDER BY t.id ASC", [id], (err, rows) => resolve(err ? [] : rows || []));
    }),
  ]);
  if (!project) return res.status(404).send('Project not found');
  try {
    res.locals.seo = forPortfolioProject(res.locals.seo, project, publicBaseUrl(req));
    const body = await ejs.renderFile(path.join(__dirname, 'views', 'partials', 'portfolio-project.ejs'), { project, projectMedia, testimonials: projectTestimonials });
    res.render('portfolio', { footerName, body, active: 'portfolio' });
  } catch (e) {
    console.error('Project render error:', e);
    res.status(500).send('Error rendering page');
  }
});

app.get('/contact', async (req, res) => {
  const address = await getBlock(
    'contact',
    'info',
    'address',
    'Honer Vivantis, Tellapur Road, Hyderabad, India, 500019'
  );
  const email = await getBlock(
    'contact',
    'info',
    'email',
    'info@designersvision.com'
  );
  const phone = await getBlock(
    'contact',
    'info',
    'phone',
    '+91 9557058902'
  );
  const footerName = await getBlock(
    'global',
    'footer',
    'owner_name',
    'Anshika Rastogi'
  );
  res.render('contact', {
    contactInfo: { address, email, phone },
    footerName,
  });
});

app.get('/admin/login', (req, res) => {
  if (req.session.adminId) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: '' });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('admin/login', {
      error: 'Please enter both username and password.',
    });
  }
  db.get(
    'SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1',
    [username],
    (err, admin) => {
      if (err || !admin) {
        return res.render('admin/login', {
          error: 'Invalid username or password.',
        });
      }
      if (!bcrypt.compareSync(password, admin.password_hash)) {
        return res.render('admin/login', {
          error: 'Invalid username or password.',
        });
      }
      req.session.adminId = admin.id;
      req.session.adminUsername = admin.username;
      res.redirect('/admin');
    }
  );
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

app.get('/admin/change-password', requireAdmin, async (req, res) => {
  try {
    const message = req.query.msg ? decodeURIComponent(String(req.query.msg).replace(/\+/g, ' ')) : '';
    const body = await ejs.renderFile(
      path.join(__dirname, 'views', 'admin', '_change_password_body.ejs'),
      { message, messageType: 'success' }
    );
    res.render('admin/change_password', { body });
  } catch (e) {
    console.error('Change password render:', e);
    res.redirect('/admin');
  }
});

app.post('/admin/change-password', requireAdmin, (req, res) => {
  const { current, new: newPass, confirm } = req.body;
  const renderForm = async (message, messageType = 'danger') => {
    try {
      const body = await ejs.renderFile(
        path.join(__dirname, 'views', 'admin', '_change_password_body.ejs'),
        { message, messageType }
      );
      res.render('admin/change_password', { body });
    } catch (e) {
      console.error('Change password render:', e);
      res.redirect('/admin');
    }
  };
  if (!current || !newPass || !confirm) {
    return renderForm('Please fill in all fields.');
  }
  if (newPass.length < 6) {
    return renderForm('New password must be at least 6 characters.');
  }
  if (newPass !== confirm) {
    return renderForm('New password and confirmation do not match.');
  }
  db.get('SELECT password_hash FROM admins WHERE id = ?', [req.session.adminId], (err, admin) => {
    if (err || !admin) {
      return renderForm('Session error. Please log in again.');
    }
    if (!bcrypt.compareSync(current, admin.password_hash)) {
      return renderForm('Current password is incorrect.');
    }
    const hash = bcrypt.hashSync(newPass, 10);
    db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, req.session.adminId], (err) => {
      if (err) {
        return renderForm('Failed to update password. Please try again.');
      }
      res.redirect('/admin/change-password?msg=Password+updated+successfully');
    });
  });
});

app.get('/admin', requireAdmin, async (req, res) => {
  let totalVisits = 0;
  try { totalVisits = await getVisitCount(); } catch (_) {}
  try {
    const body = await ejs.renderFile(path.join(__dirname, 'views', 'admin', '_dashboard_body.ejs'), { totalVisits: totalVisits ?? 0 });
    res.render('admin/dashboard', { body: body || '' });
  } catch (e) {
    console.error('Dashboard render:', e);
    res.status(500).send('Error loading dashboard: ' + (e && e.message ? e.message : String(e)));
  }
});

app.post('/admin/recordings', requireAdmin, uploadAudio.single('audio_file'), (req, res) => {
  const title = (req.body?.title || '').trim() || 'Recording';
  if (!req.file) {
    return db.all('SELECT id, slug, title, file_path, COALESCE(view_count, 0) AS view_count, created_at FROM audio_recordings ORDER BY created_at DESC', (err, rows) => {
      const baseUrl = req.protocol + '://' + req.get('host');
      const recordings = (rows || []).map(r => ({
        ...r,
        listenUrl: baseUrl + '/recording/' + r.slug,
        qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(baseUrl + '/recording/' + r.slug) + '&color=723d46&bgcolor=fce4ec&margin=10',
      }));
      renderRecordingsPage(res, req, recordings, '', 'Please select an audio file.');
    });
  }
  const slug = path.basename(req.file.filename, path.extname(req.file.filename));
  const filePath = 'assets/uploads/recordings/' + req.file.filename;
  db.run('INSERT INTO audio_recordings (slug, title, file_path) VALUES (?, ?, ?)', [slug, title, filePath], function (err) {
    if (err) {
      fs.unlink(req.file.path, () => {});
      return db.all('SELECT id, slug, title, file_path, COALESCE(view_count, 0) AS view_count, created_at FROM audio_recordings ORDER BY created_at DESC', (e, rows) => {
        const baseUrl = req.protocol + '://' + req.get('host');
        const recordings = (rows || []).map(r => ({
          ...r,
          listenUrl: baseUrl + '/recording/' + r.slug,
          qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(baseUrl + '/recording/' + r.slug) + '&color=723d46&bgcolor=fce4ec&margin=10',
        }));
        renderRecordingsPage(res, req, recordings, '', 'Could not save. Please try again.');
      });
    }
    db.all('SELECT id, slug, title, file_path, COALESCE(view_count, 0) AS view_count, created_at FROM audio_recordings ORDER BY created_at DESC', (e, rows) => {
      const baseUrl = req.protocol + '://' + req.get('host');
      const recordings = (rows || []).map(r => ({
        ...r,
        listenUrl: baseUrl + '/recording/' + r.slug,
        qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(baseUrl + '/recording/' + r.slug) + '&color=723d46&bgcolor=fce4ec&margin=10',
      }));
      renderRecordingsPage(res, req, recordings, 'Recording uploaded! Share the QR code below with users.', '');
    });
  });
});

app.get('/admin/recordings/:id/qr-download', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT slug, title FROM audio_recordings WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).send('Not found');
    const baseUrl = req.protocol + '://' + req.get('host');
    const listenUrl = baseUrl + '/recording/' + row.slug;
    const qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=' + encodeURIComponent(listenUrl) + '&color=723d46&bgcolor=ffffff&margin=15';
    const https = require('https');
    https.get(qrApiUrl, (proxyRes) => {
      res.setHeader('Content-Disposition', 'attachment; filename="qr-' + (row.title || row.slug).replace(/[^a-z0-9]/gi, '-') + '.png"');
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/png');
      proxyRes.pipe(res);
    }).on('error', () => res.status(502).send('Could not generate QR'));
  });
});

app.get('/admin/recordings/delete/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT file_path FROM audio_recordings WHERE id = ?', [id], (err, row) => {
    if (!err && row && row.file_path) {
      const filePath = path.join(__dirname, 'Kelly', row.file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.run('DELETE FROM audio_recordings WHERE id = ?', [id], () => res.redirect('/admin/recordings'));
  });
});

app.get('/admin/hero', requireAdmin, async (req, res) => {
  const greeting = await getBlock('home', 'hero', 'greeting', 'Hi, I am');
  const name = await getBlock('home', 'hero', 'name', 'Anshika Rastogi');
  const line1 = await getBlock(
    'home',
    'hero',
    'line1',
    'A professional Interior Designer and Interior Consultant from India'
  );
  const line2 = await getBlock(
    'home',
    'hero',
    'line2',
    'A creative Artist, Love to paint my thoughts on Canvas and Walls'
  );
  const line3 = await getBlock(
    'home',
    'hero',
    'line3',
    'A beautiful Classical Dancer'
  );
  res.render('admin/hero', {
    hero: { greeting, name, line1, line2, line3 },
    message: '',
  });
});

app.post('/admin/hero', requireAdmin, async (req, res) => {
  const { greeting, name, line1, line2, line3 } = req.body;
  await saveBlock('home', 'hero', 'greeting', greeting || '');
  await saveBlock('home', 'hero', 'name', name || '');
  await saveBlock('home', 'hero', 'line1', line1 || '');
  await saveBlock('home', 'hero', 'line2', line2 || '');
  await saveBlock('home', 'hero', 'line3', line3 || '');

  res.render('admin/hero', {
    hero: { greeting, name, line1, line2, line3 },
    message: 'Hero content updated successfully.',
  });
});

app.get('/admin/about', requireAdmin, async (req, res) => {
  const title = await getBlock('about', 'intro', 'title', 'About');
  const paragraph = await getBlock(
    'about',
    'intro',
    'paragraph',
    'Interior design is the art and science of enhancing interior spaces to achieve a more aesthetically pleasing and functional environment.'
  );
  res.render('admin/about', {
    aboutIntro: { title, paragraph },
    message: '',
  });
});

app.post('/admin/about', requireAdmin, async (req, res) => {
  const { title, paragraph } = req.body;
  await saveBlock('about', 'intro', 'title', title || '');
  await saveBlock('about', 'intro', 'paragraph', paragraph || '');
  res.render('admin/about', {
    aboutIntro: { title, paragraph },
    message: 'About content updated successfully.',
  });
});

app.get('/admin/contact', requireAdmin, async (req, res) => {
  const address = await getBlock(
    'contact',
    'info',
    'address',
    'Honer Vivantis, Tellapur Road, Hyderabad, India, 500019'
  );
  const email = await getBlock(
    'contact',
    'info',
    'email',
    'info@designersvision.com'
  );
  const phone = await getBlock(
    'contact',
    'info',
    'phone',
    '+91 9557058902'
  );
  res.render('admin/contact', {
    contactInfo: { address, email, phone },
    message: '',
  });
});

app.post('/admin/contact', requireAdmin, async (req, res) => {
  const { address, email, phone } = req.body;
  await saveBlock('contact', 'info', 'address', address || '');
  await saveBlock('contact', 'info', 'email', email || '');
  await saveBlock('contact', 'info', 'phone', phone || '');
  res.render('admin/contact', {
    contactInfo: { address, email, phone },
    message: 'Contact information updated successfully.',
  });
});

app.get('/admin/services', requireAdmin, (req, res) => {
  db.all(
    'SELECT id, title, image_path, sort_order FROM services ORDER BY sort_order ASC, id ASC',
    (err, rows) => {
      const services = rows || [];
      res.render('admin/services', { services, message: '' });
    }
  );
});

app.post('/admin/services', requireAdmin, upload.single('image'), (req, res) => {
  const title = req.body?.title || '';
  const imagePath = (req.file && 'assets/uploads/' + req.file.filename) || (req.body && req.body.image_path) || '';
  if (!title) {
    return db.all('SELECT id, title, image_path, sort_order FROM services ORDER BY sort_order ASC, id ASC', (err, rows) => {
      res.render('admin/services', { services: rows || [], message: 'Title is required.' });
    });
  }
  db.get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM services', (err, row) => {
    const nextOrder = row?.nextOrder ?? 0;
    db.run('INSERT INTO services (title, image_path, sort_order) VALUES (?, ?, ?)', [title, imagePath, nextOrder], () => {
      res.redirect('/admin/services');
    });
  });
});

app.post('/admin/services/:id/move-up', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.all('SELECT id, sort_order FROM services ORDER BY sort_order ASC, id ASC', (err, rows) => {
    const idx = (rows || []).findIndex(r => r.id === id);
    if (idx <= 0) return res.redirect('/admin/services');
    const prev = rows[idx - 1];
    db.run('UPDATE services SET sort_order = ? WHERE id = ?', [prev.sort_order, id]);
    db.run('UPDATE services SET sort_order = ? WHERE id = ?', [rows[idx].sort_order, prev.id], () => {
      res.redirect('/admin/services');
    });
  });
});

app.post('/admin/services/:id/move-down', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.all('SELECT id, sort_order FROM services ORDER BY sort_order ASC, id ASC', (err, rows) => {
    const idx = (rows || []).findIndex(r => r.id === id);
    if (idx < 0 || idx >= rows.length - 1) return res.redirect('/admin/services');
    const next = rows[idx + 1];
    db.run('UPDATE services SET sort_order = ? WHERE id = ?', [next.sort_order, id]);
    db.run('UPDATE services SET sort_order = ? WHERE id = ?', [rows[idx].sort_order, next.id], () => {
      res.redirect('/admin/services');
    });
  });
});

app.post('/admin/services/:id/delete', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM services WHERE id = ?', [id], () => {
    res.redirect('/admin/services');
  });
});

app.get('/admin/services/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT id, title, image_path FROM services WHERE id = ?', [id], (err, service) => {
    if (err || !service) return res.redirect('/admin/services');
    res.render('admin/service_edit', { service, message: '' });
  });
});

app.post('/admin/services/:id', requireAdmin, upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const title = req.body?.title || '';
  let imagePath = req.body?.image_path || '';
  if (req.file) imagePath = 'assets/uploads/' + req.file.filename;
  if (!title) {
    return db.get('SELECT id, title, image_path FROM services WHERE id = ?', [id], (err, service) => {
      if (err || !service) return res.redirect('/admin/services');
      res.render('admin/service_edit', { service: { ...service, image_path: imagePath }, message: 'Title is required.' });
    });
  }
  db.run('UPDATE services SET title = ?, image_path = ? WHERE id = ?', [title, imagePath, id], () => {
    res.redirect('/admin/services');
  });
});

// Testimonial submission (hidden page, not in nav - admin shares link)
app.get('/testimonial/submit/:token', (req, res) => {
  const token = req.params.token;
  db.get('SELECT id FROM testimonial_invites WHERE token = ? AND used_at IS NULL', [token], (err, row) => {
    if (err || !row) return res.render('testimonial-submit', { invalidToken: true });
    res.render('testimonial-submit', {});
  });
});

app.post('/testimonial/submit/:token', upload.any(), (req, res) => {
  const token = req.params.token;
  db.get('SELECT id FROM testimonial_invites WHERE token = ? AND used_at IS NULL', [token], (err, invite) => {
    if (err || !invite) return res.render('testimonial-submit', { invalidToken: true });
    const name = (req.body?.name || '').trim();
    const role = (req.body?.role || '').trim();
    const messageText = (req.body?.message || '').trim();
    const rating = Math.min(5, Math.max(0, parseInt(req.body?.rating, 10) || 0));
    if (!name || !messageText) return res.render('testimonial-submit', { error: 'Name and message are required.' });

    const fileList = Array.isArray(req.files) ? req.files : (req.files ? [req.files] : []);
    const profileFile = fileList.find(f => f.fieldname === 'profile_image');
    const imageFiles = fileList.filter(f => f.fieldname === 'media_images' || f.fieldname === 'media_file');
    const videoUrls = (req.body?.video_urls || '')
      .split(/[\n,]/)
      .map(u => toEmbedUrl(u.trim()))
      .filter(u => u);

    const profilePath = profileFile ? 'assets/uploads/' + profileFile.filename : '';
    db.get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM testimonials', (err2, row) => {
      const nextOrder = row?.nextOrder ?? 0;
      db.run(
        'INSERT INTO testimonials (name, role, message, image_path, rating, status, invite_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, role, messageText, profilePath, rating, 'pending', invite.id, nextOrder],
        function (insErr) {
          if (insErr) return res.render('testimonial-submit', { error: 'Could not save. Please try again.' });
          const testimonialId = this.lastID;
          db.run('UPDATE testimonial_invites SET used_at = datetime("now") WHERE id = ?', [invite.id], () => {});

          const insertMedia = (items, idx, cb) => {
            if (idx >= items.length) return cb();
            const it = items[idx];
            db.get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS so FROM testimonial_media WHERE testimonial_id = ?', [testimonialId], (e, r) => {
              const so = r?.so ?? 0;
              db.run('INSERT INTO testimonial_media (testimonial_id, type, path, sort_order) VALUES (?, ?, ?, ?)', [testimonialId, it.type, it.path, so], () => insertMedia(items, idx + 1, cb));
            });
          };

          const mediaItems = [
            ...imageFiles.map(f => ({ type: 'image', path: 'assets/uploads/' + f.filename })),
            ...videoUrls.map(url => ({ type: 'video', path: url })),
          ];
          insertMedia(mediaItems, 0, () => res.render('testimonial-submit', { success: true }));
        }
      );
    });
  });
});

app.get('/admin/testimonials', requireAdmin, (req, res) => {
  const message = req.query.msg || '';
  const inviteUrl = req.query.invite_url || '';
  db.all(
    'SELECT id, name, role, message, image_path, rating, status, sort_order FROM testimonials ORDER BY status ASC, sort_order ASC, id ASC',
    (err, rows) => {
      const testimonials = rows || [];
      db.all('SELECT id, token, created_at, used_at FROM testimonial_invites ORDER BY id DESC LIMIT 20', (err2, invites) => {
        ejs.renderFile(
          path.join(__dirname, 'views', 'admin', '_testimonials_body.ejs'),
          { testimonials, invites: invites || [], message, inviteUrl }
        ).then(bodyHtml => {
          res.render('admin/testimonials', { body: bodyHtml });
        }).catch(e => {
          console.error('Admin testimonials render:', e);
          res.status(500).send('Error');
        });
      });
    }
  );
});

app.post('/admin/testimonials/invite', requireAdmin, (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  db.run('INSERT INTO testimonial_invites (token) VALUES (?)', [token], function (err) {
    if (err) return res.redirect('/admin/testimonials?msg=Error+creating+link');
    const url = req.protocol + '://' + req.get('host') + '/testimonial/submit/' + token;
    res.redirect('/admin/testimonials?msg=Link+created&invite_url=' + encodeURIComponent(url));
  });
});

app.post('/admin/testimonials/:id/approve', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.run("UPDATE testimonials SET status = 'approved' WHERE id = ?", [id], () => res.redirect('/admin/testimonials'));
});

app.post('/admin/testimonials/:id/reject', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.run("UPDATE testimonials SET status = 'rejected' WHERE id = ?", [id], () => res.redirect('/admin/testimonials'));
});

app.post('/admin/testimonials', requireAdmin, upload.single('image'), (req, res) => {
  const name = req.body?.name || '';
  const role = req.body?.role || '';
  const messageText = req.body?.message || '';
  const imagePath = req.file ? 'assets/uploads/' + req.file.filename : '';
  if (!name || !messageText) {
    return db.all('SELECT id, name, role, message, image_path, rating, status, sort_order FROM testimonials ORDER BY status ASC, sort_order ASC, id ASC', (err, rows) => {
      db.all('SELECT id, token, created_at, used_at FROM testimonial_invites ORDER BY id DESC LIMIT 20', (err2, inv) => {
        ejs.renderFile(path.join(__dirname, 'views', 'admin', '_testimonials_body.ejs'), {
          testimonials: rows || [], invites: inv || [], message: 'Name and message are required.', inviteUrl: ''
        }).then(bodyHtml => res.render('admin/testimonials', { body: bodyHtml }))
          .catch(() => res.redirect('/admin/testimonials?msg=Error'));
      });
    });
  }
  db.get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM testimonials', (err, row) => {
    const nextOrder = row?.nextOrder ?? 0;
    db.run('INSERT INTO testimonials (name, role, message, image_path, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [name, role, messageText, imagePath, 'approved', nextOrder], () => res.redirect('/admin/testimonials'));
  });
});

app.post('/admin/testimonials/:id/move-up', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.all('SELECT id, sort_order FROM testimonials ORDER BY sort_order ASC, id ASC', (err, rows) => {
    const idx = (rows || []).findIndex(r => r.id === id);
    if (idx <= 0) return res.redirect('/admin/testimonials');
    const prev = rows[idx - 1];
    db.run('UPDATE testimonials SET sort_order = ? WHERE id = ?', [prev.sort_order, id]);
    db.run('UPDATE testimonials SET sort_order = ? WHERE id = ?', [rows[idx].sort_order, prev.id], () => {
      res.redirect('/admin/testimonials');
    });
  });
});

app.post('/admin/testimonials/:id/move-down', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.all('SELECT id, sort_order FROM testimonials ORDER BY sort_order ASC, id ASC', (err, rows) => {
    const idx = (rows || []).findIndex(r => r.id === id);
    if (idx < 0 || idx >= rows.length - 1) return res.redirect('/admin/testimonials');
    const next = rows[idx + 1];
    db.run('UPDATE testimonials SET sort_order = ? WHERE id = ?', [next.sort_order, id]);
    db.run('UPDATE testimonials SET sort_order = ? WHERE id = ?', [rows[idx].sort_order, next.id], () => {
      res.redirect('/admin/testimonials');
    });
  });
});

app.post('/admin/testimonials/:id/delete', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM testimonial_media WHERE testimonial_id = ?', [id], () => {
    db.run('DELETE FROM project_testimonials WHERE testimonial_id = ?', [id], () => {
      db.run('DELETE FROM testimonials WHERE id = ?', [id], () => res.redirect('/admin/testimonials'));
    });
  });
});

app.get('/admin/testimonials/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT id, name, role, message, image_path, rating FROM testimonials WHERE id = ?', [id], (err, testimonial) => {
    if (err || !testimonial) return res.redirect('/admin/testimonials');
    db.all('SELECT id, type, path, sort_order FROM testimonial_media WHERE testimonial_id = ? ORDER BY sort_order ASC', [id], (err2, media) => {
      ejs.renderFile(path.join(__dirname, 'views', 'admin', '_testimonial_edit_body.ejs'), { testimonial, testimonialMedia: media || [], message: '' })
        .then(body => res.render('admin/testimonial_edit', { body }))
        .catch(() => res.redirect('/admin/testimonials'));
    });
  });
});

app.post('/admin/testimonials/:id/media', requireAdmin, upload.any(), (req, res) => {
  const id = Number(req.params.id);
  const mediaType = req.body?.media_type || 'image';
  db.get('SELECT id FROM testimonials WHERE id = ?', [id], (err, t) => {
    if (err || !t) return res.redirect('/admin/testimonials');
    const files = Array.isArray(req.files) ? req.files : (req.files ? [req.files] : []);
    const imageFiles = files.filter(f => f.fieldname === 'media_files' || f.fieldname === 'media_images');
    const videoUrls = (req.body?.video_urls || '').split(/[\n,]/).map(u => toEmbedUrl(u.trim())).filter(u => u);
    const insertOne = (items, idx, cb) => {
      if (idx >= items.length) return cb();
      const it = items[idx];
      db.get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS so FROM testimonial_media WHERE testimonial_id = ?', [id], (e, r) => {
        db.run('INSERT INTO testimonial_media (testimonial_id, type, path, sort_order) VALUES (?, ?, ?, ?)', [id, it.type, it.path, r?.so ?? 0], () => insertOne(items, idx + 1, cb));
      });
    };
    const items = [...imageFiles.map(f => ({ type: 'image', path: 'assets/uploads/' + f.filename })), ...videoUrls.map(u => ({ type: 'video', path: u }))];
    insertOne(items, 0, () => res.redirect('/admin/testimonials/' + id));
  });
});

app.post('/admin/testimonials/:id/media/:mid/delete', requireAdmin, (req, res) => {
  const mid = Number(req.params.mid);
  const tid = Number(req.params.id);
  db.run('DELETE FROM testimonial_media WHERE id = ? AND testimonial_id = ?', [mid, tid], () => res.redirect('/admin/testimonials/' + tid));
});

app.post('/admin/testimonials/:id', requireAdmin, upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const name = req.body?.name || '';
  const role = req.body?.role || '';
  const messageText = req.body?.message || '';
  const rating = Math.min(5, Math.max(0, parseInt(req.body?.rating, 10) || 0));
  db.get('SELECT id, name, role, message, image_path FROM testimonials WHERE id = ?', [id], (err, testimonial) => {
    if (err || !testimonial) return res.redirect('/admin/testimonials');
    let imagePath = testimonial.image_path || '';
    if (req.file) imagePath = 'assets/uploads/' + req.file.filename;
    if (!name || !messageText) {
      return db.all('SELECT id, type, path FROM testimonial_media WHERE testimonial_id = ?', [id], (e, m) => {
        ejs.renderFile(path.join(__dirname, 'views', 'admin', '_testimonial_edit_body.ejs'), {
          testimonial: { ...testimonial, name, role, message: messageText, image_path: imagePath, rating },
          testimonialMedia: m || [],
          message: 'Name and message are required.'
        }).then(body => res.render('admin/testimonial_edit', { body })).catch(() => res.redirect('/admin/testimonials'));
      });
    }
    db.run('UPDATE testimonials SET name = ?, role = ?, message = ?, image_path = ?, rating = ? WHERE id = ?', [name, role, messageText, imagePath, rating, id], () => {
      res.redirect('/admin/testimonials');
    });
  });
});

// Helper: normalize video URL to embed format
function toEmbedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  const youtubeMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (youtubeMatch) return 'https://www.youtube.com/embed/' + youtubeMatch[1];
  const vimeoMatch = u.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return 'https://player.vimeo.com/video/' + vimeoMatch[1];
  return u;
}

app.get('/admin/portfolio', requireAdmin, (req, res) => {
  const message = req.query.msg || '';
  db.all('SELECT id, name, sort_order FROM portfolio_categories ORDER BY sort_order ASC, id ASC', (err, cats) => {
    if (err) return res.status(500).send('Error');
    const categories = cats || [];
    db.all('SELECT id, category_id, name, location, city, initial_text, cover_image_path, details, sort_order FROM portfolio_projects ORDER BY category_id, sort_order ASC, id ASC', (err, projs) => {
      const projects = projs || [];
      const projectsByCategory = {};
      categories.forEach(c => { projectsByCategory[c.id] = []; });
      projects.forEach(p => {
        if (projectsByCategory[p.category_id]) projectsByCategory[p.category_id].push(p);
      });
      res.render('admin/portfolio', { categories, projectsByCategory, message });
    });
  });
});

app.post('/admin/portfolio/categories', requireAdmin, (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) {
    return res.redirect('/admin/portfolio?msg=' + encodeURIComponent('Category name is required'));
  }
  db.get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM portfolio_categories', (err, row) => {
    if (err) {
      console.error('Portfolio category nextOrder error:', err);
      return res.redirect('/admin/portfolio?msg=' + encodeURIComponent('Database error'));
    }
    const nextOrder = row?.nextOrder ?? 0;
    db.run('INSERT INTO portfolio_categories (name, sort_order) VALUES (?, ?)', [name, nextOrder], function (err2) {
      if (err2) {
        console.error('Portfolio category insert error:', err2);
        return res.redirect('/admin/portfolio?msg=' + encodeURIComponent('Failed to add category'));
      }
      res.redirect('/admin/portfolio?msg=' + encodeURIComponent('Category added'));
    });
  });
});

app.post('/admin/portfolio/categories/:id/delete', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM project_media WHERE project_id IN (SELECT id FROM portfolio_projects WHERE category_id = ?)', [id]);
  db.run('DELETE FROM portfolio_projects WHERE category_id = ?', [id], () => {
    db.run('DELETE FROM portfolio_categories WHERE id = ?', [id], () => res.redirect('/admin/portfolio'));
  });
});

app.post('/admin/portfolio/projects', requireAdmin, upload.single('cover_image'), (req, res) => {
  const categoryId = Number(req.body?.category_id);
  const name = (req.body?.name || '').trim();
  const location = (req.body?.location || '').trim();
  const city = (req.body?.city || '').trim();
  const initialText = (req.body?.initial_text || '').trim();
  const details = (req.body?.details || '').trim();
  const coverPath = req.file ? 'assets/uploads/' + req.file.filename : '';
  if (!name || !categoryId) return res.redirect('/admin/portfolio');
  db.get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM portfolio_projects WHERE category_id = ?', [categoryId], (err, row) => {
    const nextOrder = row?.nextOrder ?? 0;
    db.run('INSERT INTO portfolio_projects (category_id, name, location, city, initial_text, cover_image_path, details, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [categoryId, name, location, city, initialText, coverPath, details, nextOrder], () => res.redirect('/admin/portfolio'));
  });
});

app.get('/admin/portfolio/projects/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const message = req.query.msg || '';
  db.get('SELECT id, category_id, name, location, city, initial_text, cover_image_path, details FROM portfolio_projects WHERE id = ?', [id], (err, project) => {
    if (err || !project) return res.redirect('/admin/portfolio');
    db.all('SELECT id, type, path, sort_order FROM project_media WHERE project_id = ? ORDER BY sort_order ASC, id ASC', [id], (err2, media) => {
      db.all('SELECT id, name, role, message FROM testimonials ORDER BY sort_order ASC, id ASC', (err3, allTestimonials) => {
        db.all('SELECT testimonial_id FROM project_testimonials WHERE project_id = ?', [id], (err4, links) => {
          const linkedIds = (links || []).map((r) => r.testimonial_id);
          const projectTestimonials = allTestimonials || [];
          ejs.renderFile(
            path.join(__dirname, 'views', 'admin', '_project_testimonials.ejs'),
            { projectTestimonials, linkedTestimonialIds: linkedIds },
            (err5, testimonialsHtml) => {
              if (err5) console.error('Testimonials partial render err:', err5);
              res.render('admin/project_edit', {
                project,
                projectMedia: media || [],
                testimonialsHtml: testimonialsHtml || '<em class="text-muted">No testimonials yet.</em>',
                message,
              });
            }
          );
        });
      });
    });
  });
});

app.post('/admin/portfolio/projects/:id', requireAdmin, upload.single('cover_image'), (req, res) => {
  const id = Number(req.params.id);
  const name = (req.body?.name || '').trim();
  const location = (req.body?.location || '').trim();
  const city = (req.body?.city || '').trim();
  const initialText = (req.body?.initial_text || '').trim();
  const details = (req.body?.details || '').trim();
  let testimonialIds = req.body?.testimonial_ids ?? req.body?.['testimonial_ids[]'];
testimonialIds = Array.isArray(testimonialIds) ? testimonialIds : (testimonialIds ? [testimonialIds] : []);
  db.get('SELECT id, cover_image_path FROM portfolio_projects WHERE id = ?', [id], (err, project) => {
    if (err || !project) return res.redirect('/admin/portfolio');
    let coverPath = project.cover_image_path || '';
    if (req.file) coverPath = 'assets/uploads/' + req.file.filename;
    db.run('UPDATE portfolio_projects SET name = ?, location = ?, city = ?, initial_text = ?, details = ?, cover_image_path = ? WHERE id = ?',
      [name || project.name, location, city, initialText, details, coverPath, id], () => {
        db.run('DELETE FROM project_testimonials WHERE project_id = ?', [id], () => {
          const ids = testimonialIds.map(Number).filter(Boolean);
          if (ids.length > 0) {
            const stmt = db.prepare('INSERT INTO project_testimonials (project_id, testimonial_id) VALUES (?, ?)');
            ids.forEach((tid) => stmt.run(id, tid));
            stmt.finalize();
          }
          res.redirect('/admin/portfolio/projects/' + id);
        });
      });
  });
});

app.post('/admin/portfolio/projects/:id/delete', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM project_media WHERE project_id = ?', [id], () => {
    db.run('DELETE FROM project_testimonials WHERE project_id = ?', [id], () => {
      db.run('DELETE FROM portfolio_projects WHERE id = ?', [id], () => res.redirect('/admin/portfolio'));
    });
  });
});

app.post('/admin/portfolio/projects/:id/media', requireAdmin, upload.any(), (req, res) => {
  const id = Number(req.params.id);
  const mediaType = req.body?.media_type || 'image';
  db.get('SELECT id FROM portfolio_projects WHERE id = ?', [id], (err, project) => {
    if (err || !project) return res.redirect('/admin/portfolio');
    const fileList = Array.isArray(req.files) ? req.files : (req.files ? [req.files] : []);
    const files = mediaType === 'image' ? fileList.filter(f => f.fieldname === 'media_files' || f.fieldname === 'media_file') : [];
    const videoUrls = (req.body?.video_urls || req.body?.video_url || '')
      .split(/[\n,]/)
      .map(u => toEmbedUrl(u.trim()))
      .filter(u => u);

    const insertNext = (paths, idx, cb) => {
      if (idx >= paths.length) return cb();
      const p = paths[idx];
      db.get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM project_media WHERE project_id = ?', [id], (err2, row) => {
        const nextOrder = row?.nextOrder ?? 0;
        db.run('INSERT INTO project_media (project_id, type, path, sort_order) VALUES (?, ?, ?, ?)', [id, p.type, p.path, nextOrder], () => {
          insertNext(paths, idx + 1, cb);
        });
      });
    };

    if (mediaType === 'image') {
      const paths = files.map(f => ({ type: 'image', path: 'assets/uploads/' + f.filename }));
      if (paths.length === 0) return res.redirect('/admin/portfolio/projects/' + id + '?msg=Select+at+least+one+image');
      insertNext(paths, 0, () => res.redirect('/admin/portfolio/projects/' + id));
    } else if (mediaType === 'video') {
      const paths = videoUrls.map(url => ({ type: 'video', path: url }));
      if (paths.length === 0) return res.redirect('/admin/portfolio/projects/' + id + '?msg=Enter+at+least+one+video+URL');
      insertNext(paths, 0, () => res.redirect('/admin/portfolio/projects/' + id));
    } else {
      res.redirect('/admin/portfolio/projects/' + id);
    }
  });
});

app.post('/admin/portfolio/projects/:id/media/:mid/delete', requireAdmin, (req, res) => {
  const projectId = Number(req.params.id);
  const mid = Number(req.params.mid);
  db.run('DELETE FROM project_media WHERE id = ? AND project_id = ?', [mid, projectId], () => {
    res.redirect('/admin/portfolio/projects/' + projectId);
  });
});

// Women's Day admin
app.get('/admin/womens-day', requireAdmin, async (req, res) => {
  const rows = await new Promise((resolve) => {
    db.all('SELECT id, name, mobile, image_path, testimonial, approved, created_at FROM womens_day_submissions ORDER BY created_at DESC', (err, r) => resolve(err ? [] : r || []));
  });
  try {
    const body = await ejs.renderFile(path.join(__dirname, 'views', 'admin', '_womens_day_body.ejs'), { submissions: rows });
    res.render('admin/womens_day', { body });
  } catch (e) {
    console.error('Women\'s Day admin render:', e);
    res.status(500).send('Error');
  }
});

app.get('/admin/womens-day/toggle/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.run('UPDATE womens_day_submissions SET approved = 1 - approved WHERE id = ?', [id], () => res.redirect('/admin/womens-day'));
});

app.get('/admin/womens-day/edit/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT id, name, mobile, image_path, testimonial, approved, created_at FROM womens_day_submissions WHERE id = ?', [id], async (err, submission) => {
    if (err || !submission) return res.redirect('/admin/womens-day');
    try {
      const body = await ejs.renderFile(path.join(__dirname, 'views', 'admin', '_womens_day_edit_body.ejs'), { submission, message: '' });
      res.render('admin/womens_day_edit', { body });
    } catch (e) {
      console.error('Women\'s Day edit render:', e);
      res.redirect('/admin/womens-day');
    }
  });
});

app.post('/admin/womens-day/edit/:id', requireAdmin, uploadWomensDay.single('photo'), (req, res) => {
  const id = Number(req.params.id);
  const name = (req.body?.name || '').trim();
  const mobile = (req.body?.mobile || '').trim();
  const testimonial = (req.body?.testimonial || '').trim();
  const approved = req.body?.approved === '1' ? 1 : 0;
  if (!name) {
    return db.get('SELECT id, name, mobile, image_path, testimonial, approved, created_at FROM womens_day_submissions WHERE id = ?', [id], async (err, submission) => {
      if (err || !submission) return res.redirect('/admin/womens-day');
      try {
        const body = await ejs.renderFile(path.join(__dirname, 'views', 'admin', '_womens_day_edit_body.ejs'), {
          submission: { ...submission, name, mobile, testimonial, approved: !!approved },
          message: 'Name is required.'
        });
        res.render('admin/womens_day_edit', { body });
      } catch (e) {
        res.redirect('/admin/womens-day');
      }
    });
  }
  db.get('SELECT id, image_path FROM womens_day_submissions WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.redirect('/admin/womens-day');
    let imagePath = row.image_path || '';
    if (req.file) {
      if (row.image_path) {
        const oldPath = path.join(__dirname, 'Kelly', row.image_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      imagePath = 'assets/uploads/womens-day/' + req.file.filename;
    }
    db.run('UPDATE womens_day_submissions SET name = ?, mobile = ?, testimonial = ?, image_path = ?, approved = ? WHERE id = ?',
      [name, mobile, testimonial, imagePath, approved, id], () => res.redirect('/admin/womens-day'));
  });
});

// Public Women's Day page
app.get('/womens-day', (req, res) => {
  db.all("SELECT id, name, image_path, testimonial, created_at FROM womens_day_submissions WHERE approved = 1 AND (image_path != '' OR testimonial != '') ORDER BY created_at DESC LIMIT 24", (err, rows) => {
    const submissions = rows || [];
    res.render('womens-day', { submissions, message: '', error: '' });
  });
});

app.post('/womens-day', uploadWomensDay.single('photo'), (req, res) => {
  const name = (req.body?.name || '').trim();
  const mobile = (req.body?.mobile || '').trim();
  const testimonial = (req.body?.testimonial || '').trim();
  let imagePath = '';
  if (req.file) imagePath = 'assets/uploads/womens-day/' + req.file.filename;

  if (!name) {
    return db.all("SELECT id, name, image_path, testimonial, created_at FROM womens_day_submissions WHERE approved = 1 AND (image_path != '' OR testimonial != '') ORDER BY created_at DESC LIMIT 24", (err, rows) => {
      res.render('womens-day', { submissions: rows || [], message: '', error: 'Please enter your name.' });
    });
  }

  db.run('INSERT INTO womens_day_submissions (name, mobile, image_path, testimonial) VALUES (?, ?, ?, ?)', [name, mobile, imagePath, testimonial], function (err) {
    if (err) {
      return db.all("SELECT id, name, image_path, testimonial, created_at FROM womens_day_submissions WHERE approved = 1 ORDER BY created_at DESC LIMIT 24", (e, rows) => {
        res.render('womens-day', { submissions: rows || [], message: '', error: 'Could not save. Please try again.' });
      });
    }
    db.all("SELECT id, name, image_path, testimonial, created_at FROM womens_day_submissions WHERE approved = 1 AND (image_path != '' OR testimonial != '') ORDER BY created_at DESC LIMIT 24", (e, rows) => {
      res.render('womens-day', { submissions: rows || [], message: "Thank you! Your submission has been shared. Happy Women's Day!", error: '' });
    });
  });
});

app.get('/admin/womens-day/delete/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT image_path FROM womens_day_submissions WHERE id = ?', [id], (err, row) => {
    if (!err && row && row.image_path) {
      const filePath = path.join(__dirname, 'Kelly', row.image_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.run('DELETE FROM womens_day_submissions WHERE id = ?', [id], () => res.redirect('/admin/womens-day'));
  });
});

app.get('/admin/facts', requireAdmin, async (req, res) => {
  const clients = await getBlock('about', 'facts', 'clients', '156');
  const projects = await getBlock('about', 'facts', 'projects', '309');
  const hours = await getBlock('about', 'facts', 'hours', '1463');
  const workers = await getBlock('about', 'facts', 'workers', '15');
  res.render('admin/facts', { facts: { clients, projects, hours, workers }, message: '' });
});

app.post('/admin/facts', requireAdmin, async (req, res) => {
  const { clients, projects, hours, workers } = req.body;
  await saveBlock('about', 'facts', 'clients', clients || '');
  await saveBlock('about', 'facts', 'projects', projects || '');
  await saveBlock('about', 'facts', 'hours', hours || '');
  await saveBlock('about', 'facts', 'workers', workers || '');
  res.render('admin/facts', { facts: { clients, projects, hours, workers }, message: 'Facts updated.' });
});

// ----- Style Discovery (from ai-style-discovery-engine.md) -----
app.get('/style-discovery', (req, res) => {
  res.render('style-discovery/landing', { error: '', step: 'capture' });
});

function styleDiscoveryOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

app.post('/style-discovery/start', express.urlencoded({ extended: false }), (req, res) => {
  const name = (req.body?.name || '').trim();
  const mobile = (req.body?.mobile || '').trim();
  if (!name || !mobile) {
    return res.render('style-discovery/landing', { error: 'Name and mobile required.', step: 'capture' });
  }
  const otp = styleDiscoveryOtp();
  db.run(
    'INSERT INTO style_discovery_leads (name, mobile, otp, step_reached) VALUES (?, ?, ?, 0)',
    [name, mobile, otp],
    function (err) {
      if (err) return res.render('style-discovery/landing', { error: 'Could not save. Try again.', step: 'capture' });
      req.session.styleDiscoveryLeadId = this.lastID;
      req.session.styleDiscoveryOtp = otp;
      if (process.env.ADMIN_BYPASS_OTP === 'true') {
        return res.redirect('/style-discovery/quiz?step=1');
      }
      res.render('style-discovery/landing', { step: 'otp', leadId: this.lastID, error: '' });
    }
  );
});

app.post('/style-discovery/verify', express.urlencoded({ extended: false }), (req, res) => {
  const code = (req.body?.otp || '').trim();
  const leadId = req.session.styleDiscoveryLeadId;
  if (!leadId) return res.redirect('/style-discovery');
  const valid = process.env.ADMIN_BYPASS_OTP === 'true' || code === req.session.styleDiscoveryOtp;
  if (!valid) {
    return res.render('style-discovery/landing', { step: 'otp', leadId, error: 'Invalid OTP.' });
  }
  res.redirect('/style-discovery/quiz?step=1');
});

app.get('/style-discovery/quiz', (req, res) => {
  if (!req.session.styleDiscoveryLeadId) return res.redirect('/style-discovery');
  const step = Math.min(10, Math.max(1, parseInt(req.query.step, 10) || 1));
  res.render('style-discovery/quiz', { step, totalSteps: 10 });
});

app.get('/style-discovery/result', (req, res) => {
  if (!req.session.styleDiscoveryLeadId) return res.redirect('/style-discovery');
  const leadId = req.session.styleDiscoveryLeadId;
  db.get('SELECT * FROM style_discovery_leads WHERE id = ?', [leadId], (err, row) => {
    const lead = err ? null : row;
    res.render('style-discovery/result', {
      personaName: lead?.persona_name || 'Your Design Persona',
      personaEssence: lead?.persona_essence || 'A reflection of your style choices.',
      calendlyLink: process.env.CALENDLY_LINK || 'https://calendly.com',
    });
  });
});

app.get('/robots.txt', (req, res) => {
  const base = publicBaseUrl(req);
  res.type('text/plain');
  res.send(
    `User-agent: *
Allow: /

# Admin and authenticated app areas — not for indexing
Disallow: /admin
Disallow: /portal/
Allow: /portal/login

Sitemap: ${base}/sitemap.xml
`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const base = publicBaseUrl(req);
  const staticPaths = [
    { loc: `${base}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${base}/about-new`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${base}/services`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${base}/portfolio`, priority: '0.95', changefreq: 'weekly' },
    { loc: `${base}/testimonials`, priority: '0.85', changefreq: 'weekly' },
    { loc: `${base}/contact`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${base}/experience`, priority: '0.75', changefreq: 'monthly' },
    { loc: `${base}/womens-day`, priority: '0.5', changefreq: 'yearly' },
    { loc: `${base}/style-discovery`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${base}/portal/login`, priority: '0.4', changefreq: 'yearly' },
  ];
  db.all('SELECT id FROM portfolio_projects ORDER BY id ASC', (err, projRows) => {
    const projectUrls = (projRows || []).map((r) => ({
      loc: `${base}/portfolio/project/${r.id}`,
      priority: '0.85',
      changefreq: 'weekly',
    }));
    db.all(
      "SELECT id FROM testimonials WHERE status = 'approved' ORDER BY id ASC",
      (e2, testRows) => {
        const testimonialUrls = (testRows || []).map((r) => ({
          loc: `${base}/testimonials/${r.id}`,
          priority: '0.7',
          changefreq: 'monthly',
        }));
        const xml = buildSitemapXml(base, [...staticPaths, ...projectUrls, ...testimonialUrls]);
        res.type('application/xml');
        res.send(xml);
      }
    );
  });
});

// ----- Imou CCTV stream (from imou-integration.md) -----
app.get('/portal/api/cctv/:projectId', async (req, res) => {
  const projectId = req.params.projectId;
  const uid = req.session.portalUserId;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const portalDb = require('./lib/portal-db');
  try {
    const can = await portalDb.canAccessProjectCctv(uid, req.session.portalUserRole, projectId);
    if (!can) return res.status(403).json({ error: 'Forbidden' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
  const db = require('./db').db;
  db.get('SELECT rtsp_link FROM portal_projects WHERE id = ?', [projectId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Project not found' });
    const rtspLink = row.rtsp_link;
    if (!rtspLink || rtspLink.trim() === '') {
      return res.json({ url: null, token: null, message: 'Live stream offline' });
    }
    const imouAppId = process.env.IMOU_APP_ID;
    const imouAppSecret = process.env.IMOU_APP_SECRET;
    if (!imouAppId || !imouAppSecret) {
      return res.json({ url: rtspLink, token: null, useRtsp: true });
    }
    const https = require('https');
    const time = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(8).toString('hex');
    const signStr = [imouAppSecret, time, nonce].sort().join('');
    const sign = require('crypto').createHash('md5').update(signStr).digest('hex');
    const body = JSON.stringify({
      params: { appId: imouAppId, appSecret: imouAppSecret },
      id: '1',
      system: { ver: '1.1', appId: imouAppId, time, nonce, sign },
    });
    const reqOpt = { hostname: 'openapi.lechange.cn', path: '/openapi/accessToken', method: 'POST', headers: { 'Content-Type': 'application/json' } };
    const extReq = https.request(reqOpt, (extRes) => {
      let data = '';
      extRes.on('data', (ch) => (data += ch));
      extRes.on('end', () => {
        try {
          const j = JSON.parse(data);
          const token = j.result?.data?.accessToken || null;
          res.json({ url: rtspLink, token, useRtsp: !token });
        } catch (_) {
          res.json({ url: rtspLink, token: null, useRtsp: true });
        }
      });
    });
    extReq.on('error', () => res.json({ url: rtspLink, token: null, useRtsp: true }));
    extReq.write(body);
    extReq.end();
  });
});

app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

