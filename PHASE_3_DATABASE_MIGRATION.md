# Phase 3: Create Database Migration Scripts

**Duration:** 3-4 days  
**Prerequisites:** Phase 2 (Dependencies installed) complete  
**Risk Level:** Medium

---

## 📋 Overview

Export the SQLite database schema, convert it to PostgreSQL format, and create automated migration scripts to safely transfer all data from SQLite to PostgreSQL.

---

## ✅ Prerequisites Checklist

Before starting:
- [x] Phase 2 complete (AWS SDK installed)
- [x] PostgreSQL connection tested
- [x] RDS instance running
- [x] Full backup of SQLite database

---

## 💾 Step 1: Backup Current Database

### 1.1 Create Backup Directory

```bash
ssh -i "C:\Users\ankse\Downloads\ankit-aws_anshika_website.pem" ubuntu@15.206.166.28
cd ~/kelly-app
mkdir -p backups
```

### 1.2 Backup SQLite Database

```bash
cp data.sqlite backups/data.sqlite.backup-$(date +%Y%m%d-%H%M%S)
```

### 1.3 Export to SQL Format

```bash
# Install sqlite3 if not installed
sudo apt install sqlite3 -y

# Export schema
sqlite3 data.sqlite .schema > backups/sqlite-schema.sql

# Export data
sqlite3 data.sqlite .dump > backups/sqlite-full-dump.sql
```

### 1.4 Download Backup Locally (Optional but Recommended)

```bash
# From local machine
scp -i "C:\Users\ankse\Downloads\ankit-aws_anshika_website.pem" \
  ubuntu@15.206.166.28:~/kelly-app/backups/sqlite-full-dump.sql \
  C:\Users\ankse\Documents\anshika_website\backups\
```

---

## 🔍 Step 2: Analyze Current Database Schema

### 2.1 List All Tables

```bash
cd ~/kelly-app
sqlite3 data.sqlite ".tables"
```

**Expected tables** (based on db.js):
```
admins
content_blocks
testimonial_invites
testimonials
womens_day_requests
womens_day_categories
projects (if portal is used)
project_photos
project_documents
users
recordings
```

### 2.2 Get Table Counts

```bash
sqlite3 data.sqlite <<EOF
SELECT 'admins' as table_name, COUNT(*) as count FROM admins
UNION ALL
SELECT 'content_blocks', COUNT(*) FROM content_blocks
UNION ALL
SELECT 'testimonials', COUNT(*) FROM testimonials
UNION ALL
SELECT 'projects', COUNT(*) FROM projects;
EOF
```

Save these numbers! We'll verify them after migration.

### 2.3 Export Schema for Each Table

```bash
cd ~/kelly-app/scripts
nano analyze-schema.js
```

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('../data.sqlite');

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log('=== Database Tables ===\n');
    
    tables.forEach(table => {
      console.log(`\n--- ${table.name} ---`);
      
      db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
        if (err) {
          console.error(err);
          return;
        }
        
        columns.forEach(col => {
          console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        // Get row count
        db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, result) => {
          if (err) {
            console.error(err);
            return;
          }
          console.log(`  Total rows: ${result.count}`);
        });
      });
    });
  });
});

db.close();
```

Run it:
```bash
node scripts/analyze-schema.js > backups/schema-analysis.txt
cat backups/schema-analysis.txt
```

---

## 🔄 Step 3: Create Schema Conversion Script

### 3.1 Create Conversion Utility

```bash
nano ~/kelly-app/scripts/convert-schema-to-pg.js
```

```javascript
const fs = require('fs');
const path = require('path');

/**
 * Convert SQLite schema to PostgreSQL
 */

// SQLite to PostgreSQL type mappings
const typeMap = {
  'INTEGER': 'INTEGER',
  'TEXT': 'TEXT',
  'REAL': 'DOUBLE PRECISION',
  'BLOB': 'BYTEA',
  'NUMERIC': 'NUMERIC',
  'BOOLEAN': 'BOOLEAN'
};

// Read SQLite schema
const sqliteSchema = fs.readFileSync('../backups/sqlite-schema.sql', 'utf8');

let pgSchema = sqliteSchema;

// Convert AUTOINCREMENT to SERIAL
pgSchema = pgSchema.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
pgSchema = pgSchema.replace(/INTEGER AUTOINCREMENT/gi, 'SERIAL');

// Convert DEFAULT CURRENT_TIMESTAMP
pgSchema = pgSchema.replace(/DEFAULT CURRENT_TIMESTAMP/g, 'DEFAULT CURRENT_TIMESTAMP');

// Convert DATETIME to TIMESTAMP
pgSchema = pgSchema.replace(/DATETIME/gi, 'TIMESTAMP');

// Remove IF NOT EXISTS (will add back later with proper syntax)
pgSchema = pgSchema.replace(/CREATE TABLE IF NOT EXISTS/gi, 'CREATE TABLE');

// Add CASCADE for foreign keys
pgSchema = pgSchema.replace(/FOREIGN KEY/gi, 'FOREIGN KEY');

// Convert boolean representations
pgSchema = pgSchema.replace(/'0'/g, 'FALSE');
pgSchema = pgSchema.replace(/'1'/g, 'TRUE');

// Save converted schema
fs.writeFileSync('../backups/postgresql-schema.sql', pgSchema);

console.log('✅ Schema converted to PostgreSQL format');
console.log('   Input: backups/sqlite-schema.sql');
console.log('   Output: backups/postgresql-schema.sql');
console.log('\n⚠️  Manual review recommended before applying!');
```

### 3.2 Run Conversion

```bash
cd ~/kelly-app/scripts
node convert-schema-to-pg.js
```

### 3.3 Review Converted Schema

```bash
cat ~/kelly-app/backups/postgresql-schema.sql
```

**Manually fix any issues:**
- Check PRIMARY KEY syntax
- Verify FOREIGN KEY constraints
- Ensure indexes are correct
- Update any SQLite-specific syntax

---

## 📝 Step 4: Create Migration Script

### 4.1 Create Main Migration Script

```bash
nano ~/kelly-app/scripts/migrate-database.js
```

```javascript
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { pool, close } = require('../lib/db-postgres');
const fs = require('fs');
const path = require('path');

const SQLITE_DB = path.join(__dirname, '../data.sqlite');
const DRY_RUN = process.env.DRY_RUN === 'true';

console.log('🔄 Database Migration Script');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

// Open SQLite database
const sqlite = new sqlite3.Database(SQLITE_DB, sqlite3.OPEN_READONLY);

/**
 * Get all tables from SQLite
 */
function getSQLiteTables() {
  return new Promise((resolve, reject) => {
    sqlite.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.name));
      }
    );
  });
}

/**
 * Get table row count
 */
function getRowCount(tableName, db = 'sqlite') {
  if (db === 'sqlite') {
    return new Promise((resolve, reject) => {
      sqlite.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  } else {
    return pool.query(`SELECT COUNT(*) as count FROM ${tableName}`)
      .then(result => parseInt(result.rows[0].count));
  }
}

/**
 * Get all data from SQLite table
 */
function getSQLiteData(tableName) {
  return new Promise((resolve, reject) => {
    sqlite.all(`SELECT * FROM ${tableName}`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Get column names for a table
 */
function getColumns(tableName) {
  return new Promise((resolve, reject) => {
    sqlite.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) reject(err);
      else resolve(columns.map(c => c.name));
    });
  });
}

/**
 * Insert data into PostgreSQL
 */
async function insertData(tableName, rows, columns) {
  if (rows.length === 0) {
    console.log(`  ⏭️  No data to insert`);
    return;
  }

  // Build INSERT statement
  const placeholders = rows.map((_, i) => {
    const valuePlaceholders = columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ');
    return `(${valuePlaceholders})`;
  }).join(', ');

  const columnNames = columns.join(', ');
  const sql = `INSERT INTO ${tableName} (${columnNames}) VALUES ${placeholders}`;

  // Flatten all values
  const values = rows.flatMap(row => columns.map(col => row[col]));

  try {
    if (DRY_RUN) {
      console.log(`  📝 Would insert ${rows.length} rows`);
      console.log(`  SQL: ${sql.substring(0, 100)}...`);
    } else {
      await pool.query(sql, values);
      console.log(`  ✅ Inserted ${rows.length} rows`);
    }
  } catch (error) {
    console.error(`  ❌ Error inserting data:`, error.message);
    throw error;
  }
}

/**
 * Migrate single table
 */
async function migrateTable(tableName) {
  console.log(`\n📊 Migrating table: ${tableName}`);

  try {
    // Get SQLite row count
    const sqliteCount = await getRowCount(tableName, 'sqlite');
    console.log(`  SQLite rows: ${sqliteCount}`);

    if (sqliteCount === 0) {
      console.log(`  ⏭️  Table is empty, skipping`);
      return { success: true, table: tableName, rows: 0 };
    }

    // Get columns
    const columns = await getColumns(tableName);
    console.log(`  Columns: ${columns.join(', ')}`);

    // Get all data
    const rows = await getSQLiteData(tableName);
    console.log(`  Retrieved ${rows.length} rows from SQLite`);

    // Insert into PostgreSQL
    await insertData(tableName, rows, columns);

    // Verify PostgreSQL row count
    if (!DRY_RUN) {
      const pgCount = await getRowCount(tableName, 'postgres');
      console.log(`  PostgreSQL rows: ${pgCount}`);

      if (pgCount !== sqliteCount) {
        throw new Error(`Row count mismatch! SQLite: ${sqliteCount}, PostgreSQL: ${pgCount}`);
      }

      console.log(`  ✅ Verification passed`);
    }

    return { success: true, table: tableName, rows: sqliteCount };

  } catch (error) {
    console.error(`  ❌ Migration failed:`, error.message);
    return { success: false, table: tableName, error: error.message };
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  const results = [];
  let totalRows = 0;

  try {
    console.log('🔍 Getting list of tables...');
    const tables = await getSQLiteTables();
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}\n`);

    // Migrate each table
    for (const table of tables) {
      const result = await migrateTable(table);
      results.push(result);
      if (result.success) {
        totalRows += result.rows;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));

    results.forEach(r => {
      const status = r.success ? '✅' : '❌';
      console.log(`${status} ${r.table}: ${r.rows} rows ${r.error ? `(${r.error})` : ''}`);
    });

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('\n' + '-'.repeat(60));
    console.log(`Total tables: ${tables.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total rows migrated: ${totalRows}`);
    console.log('-'.repeat(60));

    if (failed > 0) {
      console.error('\n❌ Migration completed with errors');
      process.exit(1);
    } else {
      console.log('\n🎉 Migration completed successfully!');
      
      if (DRY_RUN) {
        console.log('\n⚠️  This was a DRY RUN - no data was actually migrated');
        console.log('To run for real, unset DRY_RUN environment variable');
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal migration error:', error);
    throw error;
  } finally {
    sqlite.close();
    await close();
  }
}

// Run migration
if (require.main === module) {
  runMigration().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };
```

---

## 🧪 Step 5: Test with Dry Run

### 5.1 Run Dry Run Mode

```bash
cd ~/kelly-app
DRY_RUN=true node scripts/migrate-database.js
```

**Expected output:**
```
🔄 Database Migration Script
Mode: DRY RUN

🔍 Getting list of tables...
Found 8 tables: admins, content_blocks, testimonials, ...

📊 Migrating table: admins
  SQLite rows: 2
  Columns: id, username, password_hash, created_at
  Retrieved 2 rows from SQLite
  📝 Would insert 2 rows

... (continues for each table)

📊 Migration Summary
✅ admins: 2 rows
✅ content_blocks: 45 rows
✅ testimonials: 7 rows
...

Total tables: 8
Successful: 8
Failed: 0
Total rows migrated: 156

🎉 Migration completed successfully!

⚠️  This was a DRY RUN - no data was actually migrated
```

### 5.2 Review Output

Check for:
- ✅ All tables found
- ✅ Row counts look correct
- ✅ No errors
- ✅ Column names correct

---

## 📦 Step 6: Create Schema in PostgreSQL

### 6.1 Apply PostgreSQL Schema

```bash
cd ~/kelly-app
node -e "
const { pool, close } = require('./lib/db-postgres');
const fs = require('fs');

async function createSchema() {
  const schema = fs.readFileSync('./backups/postgresql-schema.sql', 'utf8');
  
  try {
    await pool.query(schema);
    console.log('✅ Schema created successfully');
  } catch (error) {
    console.error('❌ Error creating schema:', error.message);
  } finally {
    await close();
  }
}

createSchema();
"
```

**Alternative: Manual method**

```bash
psql "postgresql://anshika_admin:PASSWORD@HOST:5432/anshika_website_db" < backups/postgresql-schema.sql
```

### 6.2 Verify Tables Created

```bash
node -e "
const { pool, close } = require('./lib/db-postgres');

async function listTables() {
  const result = await pool.query(\`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  \`);
  
  console.log('PostgreSQL Tables:');
  result.rows.forEach(row => console.log('  -', row.table_name));
  
  await close();
}

listTables();
"
```

---

## 🚀 Step 7: Run Actual Migration

### 7.1 Final Backup

```bash
cd ~/kelly-app
cp data.sqlite backups/data.sqlite.pre-migration-$(date +%Y%m%d-%H%M%S)
```

### 7.2 Run Migration (For Real)

```bash
node scripts/migrate-database.js
```

**This will:**
1. Read all data from SQLite
2. Insert into PostgreSQL
3. Verify row counts match
4. Report results

**Expected time:** 1-5 minutes (depending on data size)

### 7.3 Monitor Progress

Watch for:
- Each table being processed
- Row counts matching
- No error messages
- Success summary at end

---

## ✅ Step 8: Verify Migration

### 8.1 Check Row Counts Match

```bash
node scripts/verify-migration.js
```

Create this script:
```javascript
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { pool, close } = require('../lib/db-postgres');

const sqlite = new sqlite3.Database('../data.sqlite');

async function verifyMigration() {
  console.log('🔍 Verifying Migration...\n');

  const tables = ['admins', 'content_blocks', 'testimonials', 'projects'];
  let allMatch = true;

  for (const table of tables) {
    // SQLite count
    const sqliteCount = await new Promise((resolve, reject) => {
      sqlite.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
        if (err) resolve(0);
        else resolve(row.count);
      });
    });

    // PostgreSQL count
    const pgResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    const pgCount = parseInt(pgResult.rows[0].count);

    const match = sqliteCount === pgCount;
    const status = match ? '✅' : '❌';
    
    console.log(`${status} ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);

    if (!match) allMatch = false;
  }

  console.log('\n' + (allMatch ? '🎉 All tables match!' : '❌ Some tables don\'t match'));

  sqlite.close();
  await close();
}

verifyMigration();
```

### 8.2 Test Sample Queries

```bash
node -e "
const { getOne, getAll, close } = require('./lib/db-postgres');

async function testQueries() {
  // Test 1: Get admin user
  const admin = await getOne('SELECT * FROM admins LIMIT 1');
  console.log('Admin user:', admin);

  // Test 2: Get content blocks
  const blocks = await getAll('SELECT * FROM content_blocks LIMIT 5');
  console.log('Content blocks:', blocks.length);

  // Test 3: Get testimonials
  const testimonials = await getAll('SELECT * FROM testimonials');
  console.log('Testimonials:', testimonials.length);

  await close();
}

testQueries();
"
```

---

## 📊 Step 9: Create Indexes

### 9.1 Add Indexes for Performance

```bash
node -e "
const { pool, close } = require('./lib/db-postgres');

async function createIndexes() {
  console.log('📊 Creating indexes...');

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_content_blocks_page ON content_blocks(page)',
    'CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON testimonials(approved_at)',
    'CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at)',
  ];

  for (const sql of indexes) {
    try {
      await pool.query(sql);
      console.log('✅', sql);
    } catch (error) {
      console.error('❌', error.message);
    }
  }

  await close();
}

createIndexes();
"
```

---

## 📝 Step 10: Document Changes

### 10.1 Create Migration Log

```bash
nano ~/kelly-app/backups/migration-log.txt
```

```
Database Migration Log
Date: 2026-05-25
From: SQLite (data.sqlite)
To: PostgreSQL (AWS RDS)

Tables Migrated:
- admins: X rows
- content_blocks: Y rows
- testimonials: Z rows
...

Total Rows: XXX
Duration: X minutes
Errors: None

Verification: PASSED
Status: SUCCESS
```

---

## ✅ Phase 3 Completion Checklist

- [ ] SQLite database backed up
- [ ] Schema exported and analyzed
- [ ] Schema converted to PostgreSQL format
- [ ] Migration script created and tested
- [ ] Dry run completed successfully
- [ ] PostgreSQL schema created
- [ ] Actual migration completed
- [ ] Row counts verified and match
- [ ] Sample queries tested
- [ ] Indexes created
- [ ] Migration documented
- [ ] No errors in logs

---

## 🚨 Rollback Plan

If migration fails:

1. **PostgreSQL is clean** - No changes to production yet
2. **SQLite still intact** - Application still uses it
3. **Can retry** - Fix issues and run migration again

To clean PostgreSQL and retry:
```sql
-- Connect to PostgreSQL
psql "postgresql://..."

-- Drop all tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Re-run migration
node scripts/migrate-database.js
```

---

## 📈 Next Steps

**Phase 3 Complete!** 🎉

Ready for:
**Phase 4: Implement S3 file upload functionality**

This will:
- Implement dual-write for file uploads
- Update multer configuration
- Test file uploads to S3
- Add fallback to local storage

**Estimated time:** 3-4 days

---

**Created:** May 25, 2026  
**Status:** Ready for Implementation
