/**
 * Seed portfolio with test data: categories, projects, and media.
 * Run: node seed-portfolio.js
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function seed() {
  console.log('Seeding portfolio...');

  // Add location, city columns if missing (for existing DBs)
  await run('ALTER TABLE portfolio_projects ADD COLUMN location TEXT DEFAULT ""').catch(() => {});
  await run('ALTER TABLE portfolio_projects ADD COLUMN city TEXT DEFAULT ""').catch(() => {});

  // Clear existing portfolio data
  await run('DELETE FROM project_media');
  await run('DELETE FROM portfolio_projects');
  await run('DELETE FROM portfolio_categories');

  // Insert categories
  const categories = [
    { name: 'Kitchens', sort: 0 },
    { name: 'Bedrooms', sort: 1 },
    { name: 'Living Area', sort: 2 },
    { name: 'Office', sort: 3 },
  ];

  for (const c of categories) {
    await run('INSERT INTO portfolio_categories (name, sort_order) VALUES (?, ?)', [c.name, c.sort]);
  }

  const catRows = await new Promise((resolve, reject) => {
    db.all('SELECT id, name FROM portfolio_categories ORDER BY id', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  console.log('Categories:', catRows);

  // Use first image from seed-from-old if exists, else placeholder
  const coverPath = 'assets/img/portfolio/portfolio-1.jpg';
  const mediaPaths = [
    'assets/img/portfolio/portfolio-1.jpg',
    'assets/img/portfolio/portfolio-2.jpg',
    'assets/img/render/kitchen/File 1.PNG',
  ].filter(Boolean);

  // Insert projects per category
  for (const cat of catRows) {
    const projectNames = [
      { name: `${cat.name} Project 1`, text: 'Modern design with premium finishes.' },
      { name: `${cat.name} Project 2`, text: 'Elegant and functional space.' },
    ];
    for (let i = 0; i < projectNames.length; i++) {
      const p = projectNames[i];
      await run(
        `INSERT INTO portfolio_projects (category_id, name, location, city, initial_text, cover_image_path, details, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cat.id,
          p.name,
          'Sample Location ' + (i + 1),
          'Hyderabad',
          p.text,
          mediaPaths[i % mediaPaths.length] || '',
          `Full project details for ${p.name}.\n\nThis space features quality materials and thoughtful design. The layout maximizes functionality while maintaining aesthetic appeal.`,
          i,
        ]
      );
    }
  }

  const projects = await new Promise((resolve, reject) => {
    db.all('SELECT id, category_id, name FROM portfolio_projects ORDER BY id', (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  // Add some project media (images)
  for (const proj of projects.slice(0, 4)) {
    await run(
      'INSERT INTO project_media (project_id, type, path, sort_order) VALUES (?, ?, ?, ?)',
      [proj.id, 'image', mediaPaths[proj.id % mediaPaths.length] || 'assets/img/portfolio/portfolio-1.jpg', 0]
    );
  }

  // Add a video to first project
  const firstProj = projects[0];
  if (firstProj) {
    await run(
      'INSERT INTO project_media (project_id, type, path, sort_order) VALUES (?, ?, ?, ?)',
      [firstProj.id, 'video', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 1]
    );
  }

  console.log('Portfolio seeded successfully.');
  console.log('- Categories:', catRows.length);
  console.log('- Projects:', projects.length);
  db.close();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  db.close();
  process.exit(1);
});
