const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.sqlite');

const db = new sqlite3.Database(DB_PATH);

// Initialise schema and seed data the first time.
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS content_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page TEXT NOT NULL,
      section TEXT NOT NULL,
      block_key TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      UNIQUE(page, section, block_key)
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS testimonial_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      used_at TEXT
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      message TEXT NOT NULL,
      image_path TEXT DEFAULT '',
      rating INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'approved',
      invite_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invite_id) REFERENCES testimonial_invites(id)
    )`
  );
  db.run("ALTER TABLE testimonials ADD COLUMN rating INTEGER DEFAULT 0", () => {});
  db.run("ALTER TABLE testimonials ADD COLUMN status TEXT DEFAULT 'approved'", () => {});
  db.run("ALTER TABLE testimonials ADD COLUMN invite_id INTEGER", () => {});
  // Ensure existing testimonials have status
  db.run("UPDATE testimonials SET status = 'approved' WHERE status IS NULL OR status = ''", () => {});

  db.run(
    `CREATE TABLE IF NOT EXISTS testimonial_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      testimonial_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (testimonial_id) REFERENCES testimonials(id)
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image_path TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS portfolio_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image_path TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS portfolio_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS portfolio_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      location TEXT DEFAULT '',
      city TEXT DEFAULT '',
      initial_text TEXT DEFAULT '',
      cover_image_path TEXT DEFAULT '',
      details TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES portfolio_categories(id)
    )`
  );
  db.run("ALTER TABLE portfolio_projects ADD COLUMN location TEXT DEFAULT ''", () => {});
  db.run("ALTER TABLE portfolio_projects ADD COLUMN city TEXT DEFAULT ''", () => {});

  db.run(
    `CREATE TABLE IF NOT EXISTS project_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portfolio_projects(id)
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS project_testimonials (
      project_id INTEGER NOT NULL,
      testimonial_id INTEGER NOT NULL,
      PRIMARY KEY (project_id, testimonial_id),
      FOREIGN KEY (project_id) REFERENCES portfolio_projects(id),
      FOREIGN KEY (testimonial_id) REFERENCES testimonials(id)
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS audio_recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT DEFAULT '',
      file_path TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  db.run('ALTER TABLE audio_recordings ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0', () => {});

  db.run(
    `CREATE TABLE IF NOT EXISTS womens_day_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mobile TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      testimonial TEXT DEFAULT '',
      approved INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  db.run('ALTER TABLE womens_day_submissions ADD COLUMN mobile TEXT DEFAULT ""', () => {});

  db.run(
    `CREATE TABLE IF NOT EXISTS site_stats (
      stat_key TEXT PRIMARY KEY,
      stat_value INTEGER NOT NULL DEFAULT 0
    )`
  );
  db.run("INSERT OR IGNORE INTO site_stats (stat_key, stat_value) VALUES ('total_visits', 0)", () => {});

  // ----- Portal (Luxury Interior CRM) -----
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CLIENT',
      dv_points_balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'NEW',
      notes TEXT,
      next_follow_up TEXT,
      referrer_id TEXT,
      assigned_designer_id TEXT,
      converted_project_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referrer_id) REFERENCES portal_users(id),
      FOREIGN KEY (assigned_designer_id) REFERENCES portal_users(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS lead_activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES portal_leads(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      budget REAL NOT NULL DEFAULT 0,
      current_stage INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      rtsp_link TEXT,
      personality_pdf_url TEXT,
      client_id TEXT NOT NULL,
      designer_id TEXT NOT NULL,
      final_total_cost REAL,
      dv_points_processed INTEGER NOT NULL DEFAULT 0,
      invoice_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES portal_users(id),
      FOREIGN KEY (designer_id) REFERENCES portal_users(id)
    )`
  );
  db.run('ALTER TABLE portal_projects ADD COLUMN designer_can_see_finance INTEGER NOT NULL DEFAULT 1', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN designer_can_view_mirror INTEGER NOT NULL DEFAULT 1', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN design_timeline_start TEXT', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN design_timeline_end TEXT', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN design_timeline_duration_days INTEGER', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN design_timeline_visible_to_client INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN execution_timeline_start TEXT', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN execution_timeline_end TEXT', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN execution_timeline_duration_days INTEGER', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN execution_timeline_visible_to_client INTEGER NOT NULL DEFAULT 0', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN design_timeline_completed_date TEXT', () => {});
  db.run('ALTER TABLE portal_projects ADD COLUMN execution_timeline_completed_date TEXT', () => {});
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_client_payments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      amount REAL NOT NULL,
      received_date TEXT NOT NULL,
      note TEXT,
      approved_for_client INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_timeline_extensions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      extra_days INTEGER NOT NULL,
      reason TEXT NOT NULL,
      requested_by_user_id TEXT,
      requested_by_role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by_user_id TEXT,
      reviewed_at TEXT,
      review_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_quotations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      base_total REAL NOT NULL,
      items TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      client_comments TEXT,
      approved_at TEXT,
      is_final INTEGER NOT NULL DEFAULT 0,
      pdf_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id)
    )`
  );
  db.run('ALTER TABLE portal_quotations ADD COLUMN pdf_url TEXT', () => {});
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_extra_costs (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      comment TEXT,
      client_note TEXT,
      response_note TEXT,
      replaces_id TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quotation_id) REFERENCES portal_quotations(id)
    )`
  );
  db.run('ALTER TABLE portal_extra_costs ADD COLUMN response_note TEXT', () => {});
  db.run('ALTER TABLE portal_extra_costs ADD COLUMN replaces_id TEXT', () => {}); // ignore err if column exists
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_extra_cost_comments (
      id TEXT PRIMARY KEY,
      extra_cost_id TEXT NOT NULL,
      author_type TEXT NOT NULL,
      user_id TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (extra_cost_id) REFERENCES portal_extra_costs(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_invoices (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      total_amount REAL NOT NULL,
      pdf_url TEXT NOT NULL,
      is_paid INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_media (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id)
    )`
  );
  db.run("ALTER TABLE portal_media ADD COLUMN approved INTEGER NOT NULL DEFAULT 0", () => {});
  db.run("ALTER TABLE portal_media ADD COLUMN vastu_category_name TEXT", () => {});
  db.run("ALTER TABLE portal_media ADD COLUMN uploaded_by_role TEXT", () => {});
  db.run("ALTER TABLE portal_media ADD COLUMN visible_to_designer INTEGER NOT NULL DEFAULT 1", () => {});
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_daily_updates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      author_type TEXT NOT NULL,
      author_id TEXT,
      text TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id),
      FOREIGN KEY (author_id) REFERENCES portal_users(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_daily_update_media (
      id TEXT PRIMARY KEY,
      update_id TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (update_id) REFERENCES portal_daily_updates(id)
    )`
  );
  db.run(
    "ALTER TABLE portal_daily_updates ADD COLUMN visible_to_client INTEGER NOT NULL DEFAULT 1",
    () => {}
  );
  db.run(
    "UPDATE portal_daily_updates SET visible_to_client = 1 WHERE visible_to_client IS NULL",
    () => {}
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_designs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      area_tag TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_design_versions (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      version_number INTEGER NOT NULL DEFAULT 1,
      admin_status TEXT NOT NULL DEFAULT 'PENDING_ADMIN',
      client_status TEXT NOT NULL DEFAULT 'PENDING',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (design_id) REFERENCES portal_designs(id),
      FOREIGN KEY (media_id) REFERENCES portal_media(id),
      FOREIGN KEY (created_by) REFERENCES portal_users(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_design_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      design_id_2d TEXT NOT NULL,
      design_id_3d TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id),
      FOREIGN KEY (design_id_2d) REFERENCES portal_designs(id),
      FOREIGN KEY (design_id_3d) REFERENCES portal_designs(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_design_comments (
      id TEXT PRIMARY KEY,
      design_version_id TEXT NOT NULL,
      author_type TEXT NOT NULL,
      user_id TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (design_version_id) REFERENCES portal_design_versions(id),
      FOREIGN KEY (user_id) REFERENCES portal_users(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_complaints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES portal_projects(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES portal_users(id)
    )`
  );
  db.run('ALTER TABLE portal_notifications ADD COLUMN category TEXT NOT NULL DEFAULT \'SYSTEM\'', () => {});
  db.run('ALTER TABLE portal_notifications ADD COLUMN link_url TEXT', () => {});
  db.run('ALTER TABLE portal_notifications ADD COLUMN project_id TEXT', () => {});
  db.run('ALTER TABLE portal_notifications ADD COLUMN read_at TEXT', () => {});
  db.run(
    `CREATE TABLE IF NOT EXISTS portal_notification_routing (
      category TEXT PRIMARY KEY,
      notify_client INTEGER NOT NULL DEFAULT 1,
      notify_admin INTEGER NOT NULL DEFAULT 1,
      notify_designer INTEGER NOT NULL DEFAULT 0
    )`
  );
  const notifyCats = [
    ['SYSTEM', 1, 1, 0],
    ['PROJECT', 1, 1, 1],
    ['FINANCE', 1, 1, 0],
    ['DESIGN', 1, 1, 1],
    ['MEDIA', 1, 1, 1],
    ['TIMELINE', 1, 1, 1],
    ['DAILY', 1, 1, 1],
    ['DOCUMENTS', 1, 1, 1],
    ['LEAD', 0, 1, 1],
    ['COMMENT', 1, 1, 1],
  ];
  notifyCats.forEach(([cat, c, a, d]) => {
    db.run(
      'INSERT OR IGNORE INTO portal_notification_routing (category, notify_client, notify_admin, notify_designer) VALUES (?, ?, ?, ?)',
      [cat, c, a, d]
    );
  });
  db.run(
    `CREATE TABLE IF NOT EXISTS style_discovery_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      otp TEXT,
      persona_name TEXT,
      persona_essence TEXT,
      persona_elements TEXT,
      hero_image_url TEXT,
      pdf_url TEXT,
      step_reached INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Seed default admin if none exists
  db.get('SELECT COUNT(*) AS cnt FROM admins', (err, row) => {
    if (err) return;
    if (!row || row.cnt === 0) {
      const username = 'admin';
      const passwordPlain = 'Admin@123';
      const passwordHash = bcrypt.hashSync(passwordPlain, 10);
      db.run(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        [username, passwordHash]
      );
    }
  });

  // Helper to seed a content block if it does not exist
  const seedBlock = (page, section, key, content) => {
    db.run(
      `INSERT OR IGNORE INTO content_blocks (page, section, block_key, content)
       VALUES (?, ?, ?, ?)`,
      [page, section, key, content]
    );
  };

  // Hero defaults
  seedBlock('home', 'hero', 'greeting', 'Hi, I am');
  seedBlock('home', 'hero', 'name', 'Anshika Rastogi');
  seedBlock(
    'home',
    'hero',
    'line1',
    'A professional Interior Designer and Interior Consultant from India'
  );
  seedBlock(
    'home',
    'hero',
    'line2',
    'A creative Artist, Love to paint my thoughts on Canvas and Walls'
  );
  seedBlock('home', 'hero', 'line3', 'A beautiful Classical Dancer');

  // About intro
  seedBlock('about', 'intro', 'title', 'About');
  seedBlock(
    'about',
    'intro',
    'paragraph',
    'Interior design is the art and science of enhancing interior spaces to achieve a more aesthetically pleasing and functional environment.'
  );

  // Contact info
  seedBlock(
    'contact',
    'info',
    'address',
    'Honer Vivantis, Tellapur Road, Hyderabad, India, 500019'
  );
  seedBlock('contact', 'info', 'email', 'info@designersvision.com');
  seedBlock('contact', 'info', 'phone', '+91 9557058902');

  // Footer owner name
  seedBlock('global', 'footer', 'owner_name', 'Anshika Rastogi');

  // Facts (About page stats)
  seedBlock('about', 'facts', 'clients', '156');
  seedBlock('about', 'facts', 'projects', '309');
  seedBlock('about', 'facts', 'hours', '1463');
  seedBlock('about', 'facts', 'workers', '15');

  // Seed testimonials, services, portfolio from static site (only when empty)
  const { testimonials, services, facts } = require('./seed-data');
  db.get('SELECT COUNT(*) AS cnt FROM testimonials', (err, row) => {
    if (!err && row && row.cnt === 0) {
      const stmt = db.prepare('INSERT INTO testimonials (name, role, message, image_path, sort_order) VALUES (?, ?, ?, ?, ?)');
      testimonials.forEach((t, i) => stmt.run(t.name, t.role, t.message, t.image_path || '', i));
      stmt.finalize();
    }
  });
  db.get('SELECT COUNT(*) AS cnt FROM services', (err, row) => {
    if (!err && row && row.cnt === 0) {
      const stmt = db.prepare('INSERT INTO services (title, image_path, sort_order) VALUES (?, ?, ?)');
      services.forEach((s, i) => stmt.run(s.title, s.image_path || '', i));
      stmt.finalize();
    }
  });
  db.get('SELECT COUNT(*) AS cnt FROM portfolio_items', (err, row) => {
    if (!err && row && row.cnt === 0) {
      const portfolioItems = require('./seed-data').getPortfolioItems();
      const stmt = db.prepare('INSERT INTO portfolio_items (title, category, image_path, sort_order) VALUES (?, ?, ?, ?)');
      portfolioItems.forEach((p, i) => stmt.run(p.title, p.category, p.image_path, i));
      stmt.finalize();
    }
  });
  db.get('SELECT COUNT(*) AS cnt FROM portfolio_categories', (err, row) => {
    if (!err && row && row.cnt === 0) {
      const defaultCats = ['Kitchens', 'Bedrooms', 'Living Area', 'Office', 'Hospital', 'Dining', 'Bar', 'Wardrobe', 'Crockery'];
      const stmt = db.prepare('INSERT INTO portfolio_categories (name, sort_order) VALUES (?, ?)');
      defaultCats.forEach((name, i) => stmt.run(name, i));
      stmt.finalize();
    }
  });
  db.get('SELECT content FROM content_blocks WHERE page = ? AND section = ? AND block_key = ?', ['about', 'facts', 'clients'], (err, row) => {
    if (!err && (!row || !row.content)) {
      seedBlock('about', 'facts', 'clients', facts.clients);
      seedBlock('about', 'facts', 'projects', facts.projects);
      seedBlock('about', 'facts', 'hours', facts.hours);
      seedBlock('about', 'facts', 'workers', facts.workers);
    }
  });
});

function getBlock(page, section, key, defaultValue) {
  return new Promise((resolve) => {
    db.get(
      'SELECT content FROM content_blocks WHERE page = ? AND section = ? AND block_key = ? LIMIT 1',
      [page, section, key],
      (err, row) => {
        if (err || !row || !row.content) {
          resolve(defaultValue);
        } else {
          resolve(row.content);
        }
      }
    );
  });
}

function getBlocksForHome() {
  return new Promise((resolve) => {
    db.all(
      "SELECT section, block_key, content FROM content_blocks WHERE page = 'home' AND (section, block_key) IN (('hero','greeting'),('hero','name'),('hero','line1'),('hero','line2'),('hero','line3'))",
      [],
      (err, rows) => {
        const map = {};
        if (!err && rows) rows.forEach(r => { map[r.section + '.' + r.block_key] = r.content || ''; });
        resolve({
          greeting: map['hero.greeting'] || 'Hi, I am',
          name: map['hero.name'] || 'Anshika Rastogi',
          line1: map['hero.line1'] || 'A professional Interior Designer and Interior Consultant from India',
          line2: map['hero.line2'] || 'A creative Artist, Love to paint my thoughts on Canvas and Walls',
          line3: map['hero.line3'] || 'A beautiful Classical Dancer',
        });
      }
    );
  });
}

function saveBlock(page, section, key, content) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO content_blocks (page, section, block_key, content)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(page, section, block_key)
       DO UPDATE SET content = excluded.content`,
      [page, section, key, content],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function incrementVisitCount() {
  return new Promise((resolve, reject) => {
    db.run('UPDATE site_stats SET stat_value = stat_value + 1 WHERE stat_key = ?', ['total_visits'], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getVisitCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT stat_value FROM site_stats WHERE stat_key = ?', ['total_visits'], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.stat_value : 0);
    });
  });
}

module.exports = {
  db,
  getBlock,
  getBlocksForHome,
  saveBlock,
  incrementVisitCount,
  getVisitCount,
};

