/**
 * Seed portal users for testing (from PORTAL_FLOW_TEST.md)
 * Run: node seed-portal.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const portalDb = require('./lib/portal-db');

const users = [
  { email: 'admin@example.com', password: 'Admin@123', fullName: 'Portal Admin', role: 'ADMIN' },
  { email: 'designer@example.com', password: 'Designer@123', fullName: 'Test Designer', role: 'DESIGNER' },
  { email: 'client@example.com', password: 'Client@123', fullName: 'Test Client', role: 'CLIENT' },
];

async function seed() {
  for (const u of users) {
    const existing = await portalDb.getUserByEmail(u.email);
    if (existing) {
      console.log('Skip (exists):', u.email);
      continue;
    }
    const hash = bcrypt.hashSync(u.password, 10);
    await portalDb.createUser({
      email: u.email,
      passwordHash: hash,
      fullName: u.fullName,
      role: u.role,
    });
    console.log('Created:', u.email, u.role);
  }
  console.log('Portal seed done.');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
