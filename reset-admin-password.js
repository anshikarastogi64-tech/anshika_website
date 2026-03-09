#!/usr/bin/env node
/**
 * Reset admin password from command line.
 * Run from the SAME folder as server.js (where data.sqlite lives).
 * Usage: node reset-admin-password.js "YourNewPassword"
 *        node reset-admin-password.js "YourNewPassword" username
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.sqlite');
const newPassword = (process.argv[2] || '').trim();
const username = (process.argv[3] || 'admin').trim();

if (!newPassword) {
  console.error('Usage: node reset-admin-password.js "YourNewPassword" [username]');
  console.error('Example: node reset-admin-password.js "MySecure@123"');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found:', DB_PATH);
  console.error('Run this script from the folder where server.js and data.sqlite are located.');
  process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);
const hash = bcrypt.hashSync(newPassword, 10);

db.run('UPDATE admins SET password_hash = ? WHERE username = ?', [hash, username], function (err) {
  if (err) {
    db.close();
    console.error('Error:', err.message);
    process.exit(1);
  }
  if (this.changes === 0) {
    db.close();
    console.error(`No admin found with username "${username}".`);
    process.exit(1);
  }
  const ok = bcrypt.compareSync(newPassword, hash);
  db.close();
  if (!ok) {
    console.error('Verification failed. Please try again.');
    process.exit(1);
  }
  console.log('Password updated for "' + username + '".');
  console.log('DB: ' + DB_PATH);
  console.log('You can now log in with the new password.');
});
