/**
 * Force reseed script - clears and reseeds testimonials, services, and portfolio items
 * Uses seed-from-old.json if present (from extract-old-data.js), otherwise seed-data.js
 * Run: node reseed.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

let testimonials, services, portfolioItems;

const seedFromOld = path.join(__dirname, 'seed-from-old.json');
if (fs.existsSync(seedFromOld)) {
  const data = JSON.parse(fs.readFileSync(seedFromOld, 'utf8'));
  testimonials = data.testimonials || [];
  services = data.services || [];
  portfolioItems = data.portfolioItems || [];
  console.log('Using seed-from-old.json');
} else {
  const seedData = require('./seed-data');
  testimonials = seedData.testimonials || [];
  services = seedData.services || [];
  portfolioItems = seedData.getPortfolioItems ? seedData.getPortfolioItems() : [];
  console.log('Using seed-data.js');
}

db.serialize(() => {
  console.log('Starting reseed...');

  db.run('DELETE FROM testimonials');
  db.run('DELETE FROM services');
  db.run('DELETE FROM portfolio_items');

  setTimeout(() => {
    const stmt1 = db.prepare('INSERT INTO testimonials (name, role, message, image_path, sort_order) VALUES (?, ?, ?, ?, ?)');
    testimonials.forEach((t, i) => stmt1.run(t.name, t.role || '', t.message, t.image_path || '', i));
    stmt1.finalize();
    console.log(`Inserted ${testimonials.length} testimonials`);

    const stmt2 = db.prepare('INSERT INTO services (title, image_path, sort_order) VALUES (?, ?, ?)');
    services.forEach((s, i) => stmt2.run(s.title, s.image_path || '', i));
    stmt2.finalize();
    console.log(`Inserted ${services.length} services`);

    const stmt3 = db.prepare('INSERT INTO portfolio_items (title, category, image_path, sort_order) VALUES (?, ?, ?, ?)');
    portfolioItems.forEach((p, i) => stmt3.run(p.title, p.category || '', p.image_path || '', i));
    stmt3.finalize();
    console.log(`Inserted ${portfolioItems.length} portfolio items`);

    console.log('\nReseed completed successfully!');
    db.close();
  }, 500);
});
