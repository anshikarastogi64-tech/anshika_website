#!/usr/bin/env node
/**
 * Create a Portal admin user (portal_users with role ADMIN).
 * Run from project root (same folder as server.js and data.sqlite).
 *
 * Usage:
 *   node create-portal-admin.js <email> <password> [fullName]
 *
 * Examples:
 *   node create-portal-admin.js admin@example.com "MySecure@123"
 *   node create-portal-admin.js admin@anshikarastogi.com "SecretPass" "Anshika Admin"
 *
 * If the email already exists, the script will exit without changing the password.
 * To set a new password for an existing user, use the Portal UI (Admin → Users) or update the DB manually.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const portalDb = require('./lib/portal-db');

const email = (process.argv[2] || '').trim();
const password = (process.argv[3] || '').trim();
const fullName = (process.argv[4] || 'Portal Admin').trim();

if (!email || !password) {
  console.error('Usage: node create-portal-admin.js <email> <password> [fullName]');
  console.error('Example: node create-portal-admin.js admin@example.com "MySecure@123"');
  process.exit(1);
}

if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

async function main() {
  const existing = await portalDb.getUserByEmail(email);
  if (existing) {
    console.log('User already exists:', email, '(role:', existing.role + ')');
    console.log('To change password, use Portal → Admin → Users, or update the DB manually.');
    process.exit(0);
  }
  const hash = bcrypt.hashSync(password, 10);
  await portalDb.createUser({
    email,
    passwordHash: hash,
    fullName,
    role: 'ADMIN',
  });
  console.log('Portal admin created:', email);
  console.log('Log in at: /portal/login');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
