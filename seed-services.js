/**
 * Seed services table with the original static site content.
 * Run: node seed-services.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

const { services } = require('./seed-data');

db.serialize(() => {
  db.run('DELETE FROM services', (err) => {
    if (err) {
      console.error('Error clearing services:', err);
      db.close();
      return;
    }
    const stmt = db.prepare('INSERT INTO services (title, image_path, sort_order) VALUES (?, ?, ?)');
    services.forEach((s, i) => stmt.run(s.title, s.image_path || '', i));
    stmt.finalize((err) => {
      if (err) console.error('Error inserting:', err);
      else console.log(`Inserted ${services.length} services successfully.`);
      db.close();
    });
  });
});
