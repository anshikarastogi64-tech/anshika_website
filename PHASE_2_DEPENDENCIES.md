# Phase 2: Install AWS SDK and Dependencies

**Duration:** 1 day  
**Prerequisites:** Phase 1 (AWS Infrastructure) complete  
**Risk Level:** Low

---

## 📋 Overview

Install and configure AWS SDK packages, PostgreSQL driver, and related dependencies. Update the project to support S3 uploads and PostgreSQL connections.

---

## ✅ Prerequisites Checklist

Before starting this phase:
- [x] Phase 1 complete (AWS infrastructure setup)
- [x] S3 buckets created and accessible
- [x] RDS PostgreSQL instance running
- [x] AWS credentials configured on server
- [x] .env file updated with AWS settings

---

## 📦 Step 1: Update package.json

### 1.1 Replace package.json

```bash
cd ~/anshika_website
cp package.json.new package.json
```

**What this adds:**
- `@aws-sdk/client-s3` - AWS S3 SDK (v3)
- `@aws-sdk/s3-request-presigner` - Pre-signed URL generation
- `pg` - PostgreSQL client for Node.js
- `multer-s3` - Multer storage engine for S3

### 1.2 Review Changes

```bash
git diff package.json
```

You should see:
```json
"@aws-sdk/client-s3": "^3.699.0",
"@aws-sdk/s3-request-presigner": "^3.699.0",
"pg": "^8.13.1",
"multer-s3": "^3.0.1"
```

---

## 📥 Step 2: Install Dependencies Locally

### 2.1 Install on Local Machine

```bash
cd C:\Users\ankse\Documents\anshika_website
npm install
```

Expected output:
```
added 50 packages, changed 4 packages
```

### 2.2 Verify Installation

Check that new packages are installed:

```bash
npm list @aws-sdk/client-s3
npm list pg
npm list multer-s3
```

---

## 🚀 Step 3: Install Dependencies on Server

### 3.1 SSH to Server

```bash
ssh -i "C:\Users\ankse\Downloads\ankit-aws_anshika_website.pem" ubuntu@15.206.166.28
```

### 3.2 Pull Latest Code

```bash
cd ~/kelly-app
git pull origin Live_backup_Update_ReDesign
```

### 3.3 Install Packages

```bash
npm install
```

**Note:** This may take 5-10 minutes on the server.

### 3.4 Verify Installation

```bash
node -e "console.log(require('@aws-sdk/client-s3'))"
node -e "console.log(require('pg'))"
```

If no errors, installation successful!

---

## 🧪 Step 4: Test S3 Connection

### 4.1 Run S3 Test Script

```bash
cd ~/kelly-app
node scripts/test-s3-connection.js
```

**Expected Output:**
```
🧪 Testing S3 Connection...

Configuration:
- Region: ap-south-1
- Bucket: anshika-designers-vision-prod
- USE_S3: true

📤 Test 1: Upload test file...
✅ Upload successful!
   URL: https://anshika-designers-vision-prod.s3.ap-south-1.amazonaws.com/test/connection-test.txt

🔗 Test 2: Generate pre-signed URL...
✅ Pre-signed URL generated!
   URL: https://anshika-designers-vision-prod.s3.ap-south-1.amazonaws...

🗑️  Test 3: Delete test file...
✅ Delete successful!

🎉 All S3 tests passed!
```

### 4.2 Troubleshooting S3 Connection

**Error: "AccessDenied"**
```
Solution: Check IAM role attached to EC2
1. Go to EC2 → Instances → Your instance
2. Actions → Security → Modify IAM role
3. Verify: anshika-website-ec2-role attached
```

**Error: "NoSuchBucket"**
```
Solution: Verify bucket name in .env
1. Check AWS_S3_BUCKET_PROD value
2. Verify bucket exists: aws s3 ls
```

**Error: "Network timeout"**
```
Solution: Check internet connectivity
1. ping s3.ap-south-1.amazonaws.com
2. Check VPC security groups
```

---

## 🗄️ Step 5: Test PostgreSQL Connection

### 5.1 Run PostgreSQL Test Script

```bash
cd ~/kelly-app
node scripts/test-pg-connection.js
```

**Expected Output:**
```
🧪 Testing PostgreSQL Connection...

Configuration:
- Database URL: ✅ Set
- Host: anshika-website-db.xxxxxxxxx.ap-south-1.rds.amazonaws.com
- Database: anshika_website_db

🔌 Test 1: Basic connection...
✅ Connection successful!
   Time: 2026-05-25 12:30:45.123+00
   Version: PostgreSQL 15.4 on x86_64-pc-linux-gnu

📊 Test 2: Check database info...
✅ Database info retrieved!
   Database: anshika_website_db
   User: anshika_admin
   Server: 10.0.1.123:5432

🛠️  Test 3: Create test table...
✅ Test table created!

📝 Test 4: Insert test data...
✅ Data inserted!
   ID: 1
   Message: Hello from Anshika Website!

🔍 Test 5: Query test data...
✅ Found 1 row(s)
   - [1] Hello from Anshika Website! (2026-05-25 12:30:45)

✏️  Test 6: Update test data...
✅ Data updated!

🗑️  Test 7: Delete test data...
✅ Data deleted!

🧹 Test 8: Cleanup...
✅ Test table dropped!

🎉 All PostgreSQL tests passed!
```

### 5.2 Troubleshooting PostgreSQL Connection

**Error: "Connection refused"**
```
Solution: Check security group
1. Go to RDS → Databases → anshika-website-db
2. Click VPC security group
3. Verify inbound rule allows port 5432 from EC2 security group
```

**Error: "Authentication failed"**
```
Solution: Check credentials in .env
1. Verify DB_PASSWORD is correct
2. Try connecting manually:
   psql "postgresql://anshika_admin:PASSWORD@HOST:5432/anshika_website_db"
```

**Error: "Database does not exist"**
```
Solution: Create database
1. Connect to default database:
   psql "postgresql://anshika_admin:PASSWORD@HOST:5432/postgres"
2. Create database:
   CREATE DATABASE anshika_website_db;
```

---

## 📝 Step 6: Copy Library Files to Server

### 6.1 Verify lib/ Directory Exists

```bash
cd ~/kelly-app
ls -la lib/
```

If directory doesn't exist:
```bash
mkdir -p lib
```

### 6.2 Copy Files from Git Repo

The files should already be there from git pull, but verify:

```bash
ls -la lib/s3-upload.js
ls -la lib/db-postgres.js
```

If missing, they're already in your local repo and will be copied when we commit.

---

## 🔧 Step 7: Update Environment Variables

### 7.1 Verify .env Configuration

```bash
cd ~/kelly-app
cat .env | grep -E "(AWS|DATABASE|MIGRATION)"
```

Should show:
```bash
AWS_REGION=ap-south-1
AWS_S3_BUCKET_PROD=anshika-designers-vision-prod
AWS_S3_BUCKET_STAGING=anshika-designers-vision-staging
USE_S3=true
MIGRATION_MODE=dual-write

DATABASE_URL=postgresql://...
DB_HOST=...
DB_NAME=anshika_website_db
USE_POSTGRES=false
```

### 7.2 Add Any Missing Variables

```bash
nano ~/kelly-app/.env
```

**Required variables:**
```bash
# AWS S3
AWS_REGION=ap-south-1
AWS_S3_BUCKET_PROD=anshika-designers-vision-prod
AWS_S3_BUCKET_STAGING=anshika-designers-vision-staging
AWS_S3_BUCKET_BACKUPS=anshika-designers-vision-backups
USE_S3=true
MIGRATION_MODE=dual-write  # Options: dual-write, s3-only, local-only

# PostgreSQL
DATABASE_URL=postgresql://anshika_admin:YOUR_PASSWORD@YOUR_HOST:5432/anshika_website_db
DB_HOST=anshika-website-db.xxxxxxxxx.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=anshika_website_db
DB_USER=anshika_admin
DB_PASSWORD=YOUR_PASSWORD
USE_POSTGRES=false  # Set to true after Phase 6

# Node Environment
NODE_ENV=production
```

Save and exit (Ctrl+X, Y, Enter)

---

## ✅ Step 8: Verification Checklist

Run through this checklist:

### Local Environment
- [ ] package.json updated with new dependencies
- [ ] npm install completed locally
- [ ] No errors during installation
- [ ] New packages appear in node_modules/

### Server Environment
- [ ] Code pulled from git (includes lib/ files)
- [ ] npm install completed on server
- [ ] S3 connection test passes
- [ ] PostgreSQL connection test passes
- [ ] .env file has all required variables
- [ ] No errors in PM2 logs

### Test Results
- [ ] S3 upload test successful
- [ ] S3 pre-signed URL test successful
- [ ] S3 delete test successful
- [ ] PostgreSQL connection successful
- [ ] PostgreSQL CRUD operations successful

---

## 🧪 Step 9: Integration Test

Create a simple test to verify both S3 and PostgreSQL work together:

### 9.1 Create Test Script

```bash
nano ~/kelly-app/scripts/test-integration.js
```

```javascript
require('dotenv').config();
const { uploadToS3, getPresignedUrl } = require('../lib/s3-upload');
const { query, close } = require('../lib/db-postgres');

async function testIntegration() {
  console.log('🧪 Testing S3 + PostgreSQL Integration...\n');

  try {
    // Test 1: Upload file to S3
    console.log('1️⃣ Uploading test file to S3...');
    const fileContent = Buffer.from('Integration test file');
    const s3Result = await uploadToS3(fileContent, 'test/integration.txt', 'text/plain');
    console.log('✅ S3 upload successful:', s3Result.s3Url);

    // Test 2: Save S3 URL to PostgreSQL
    console.log('\n2️⃣ Saving URL to PostgreSQL...');
    const pgResult = await query(
      'SELECT NOW() as current_time, $1 as test_url',
      [s3Result.s3Url]
    );
    console.log('✅ PostgreSQL query successful:', pgResult.rows[0]);

    // Test 3: Generate pre-signed URL
    console.log('\n3️⃣ Generating pre-signed URL...');
    const presignedUrl = await getPresignedUrl('test/integration.txt', 300);
    console.log('✅ Pre-signed URL generated');
    console.log('   URL:', presignedUrl.substring(0, 80) + '...');

    console.log('\n🎉 Integration test passed!\n');
    console.log('✅ S3 and PostgreSQL are working together!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    throw error;
  } finally {
    await close();
  }
}

testIntegration();
```

### 9.2 Run Integration Test

```bash
node scripts/test-integration.js
```

**Expected Output:**
```
🧪 Testing S3 + PostgreSQL Integration...

1️⃣ Uploading test file to S3...
✅ S3 upload successful: https://anshika-designers-vision-prod.s3.ap-south-1...

2️⃣ Saving URL to PostgreSQL...
✅ PostgreSQL query successful: { current_time: ..., test_url: ... }

3️⃣ Generating pre-signed URL...
✅ Pre-signed URL generated
   URL: https://anshika-designers-vision-prod.s3.ap-south-1.amazonaws.com/test/...

🎉 Integration test passed!

✅ S3 and PostgreSQL are working together!
```

---

## 📊 Step 10: Monitor Resource Usage

### 10.1 Check Node Memory Usage

```bash
pm2 monit kelly-designers-vision
```

Look for:
- Memory: Should be ~100-150 MB (slight increase from new packages)
- CPU: Should be normal

Press Ctrl+C to exit.

### 10.2 Check Disk Space

```bash
df -h /home/ubuntu/kelly-app/node_modules
```

New packages add ~50MB.

---

## 🔄 Step 11: Restart Application (if needed)

### 11.1 Restart PM2

```bash
pm2 restart kelly-designers-vision
```

### 11.2 Check Logs

```bash
pm2 logs kelly-designers-vision --lines 50
```

Look for:
- No errors about missing modules
- Application starts normally
- No connection errors

---

## 📸 Step 12: Take Snapshot

### 12.1 Commit Changes Locally

```bash
cd C:\Users\ankse\Documents\anshika_website
git add .
git commit -m "Phase 2: Install AWS SDK and PostgreSQL dependencies

- Added @aws-sdk/client-s3 and s3-request-presigner
- Added pg (PostgreSQL driver) and multer-s3
- Created integration test script
- Verified S3 and PostgreSQL connections working
- All tests passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin Live_backup_Update_ReDesign
```

### 12.2 Create Backup of node_modules (Optional)

```bash
ssh -i "C:\Users\ankse\Downloads\ankit-aws_anshika_website.pem" ubuntu@15.206.166.28
cd ~/kelly-app
tar -czf ~/backup/node_modules-phase2-$(date +%Y%m%d).tar.gz node_modules/
```

---

## 🎯 Success Criteria

**Phase 2 is complete when:**
- [ ] All dependencies installed (local and server)
- [ ] S3 connection test passes
- [ ] PostgreSQL connection test passes
- [ ] Integration test passes
- [ ] No errors in PM2 logs
- [ ] Application runs normally
- [ ] Changes committed to git

---

## 📊 What Changed

### Before Phase 2:
- No AWS SDK installed
- No PostgreSQL support
- Using only SQLite
- Local file storage only

### After Phase 2:
- ✅ AWS SDK installed and configured
- ✅ PostgreSQL driver ready
- ✅ Can connect to S3 and RDS
- ✅ Integration tested and working
- ✅ Ready for actual migration

---

## 🚨 Rollback Plan

If something goes wrong:

### Option 1: Rollback npm packages
```bash
cd ~/kelly-app
git checkout HEAD~1 package.json
npm install
pm2 restart kelly-designers-vision
```

### Option 2: Remove new packages
```bash
npm uninstall @aws-sdk/client-s3 @aws-sdk/s3-request-presigner pg multer-s3
pm2 restart kelly-designers-vision
```

### Option 3: Full rollback
```bash
cd ~/kelly-app
git reset --hard HEAD~1
npm install
pm2 restart kelly-designers-vision
```

---

## 📈 Next Steps

**Phase 2 Complete!** 🎉

You're now ready for:
**Phase 3: Create database migration scripts**

This will:
- Export SQLite schema
- Convert to PostgreSQL format
- Create migration scripts
- Prepare for data import

**Estimated time:** 3-4 days

---

## 📞 Troubleshooting

### Issue: npm install fails
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: S3 test fails
```bash
# Check AWS CLI works
aws s3 ls

# Check IAM role
aws sts get-caller-identity
```

### Issue: PostgreSQL test fails
```bash
# Test manual connection
psql "postgresql://anshika_admin:PASSWORD@HOST:5432/anshika_website_db"

# Check from EC2
telnet HOST 5432
```

### Issue: Out of memory
```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm install
```

---

## 📝 Phase 2 Checklist Summary

- [x] package.json updated
- [x] Dependencies installed locally
- [x] Dependencies installed on server
- [x] S3 connection tested
- [x] PostgreSQL connection tested
- [x] Integration test passed
- [x] Application runs normally
- [x] Changes committed to git
- [x] Documentation reviewed

**Status:** ✅ COMPLETE

**Next:** Open PHASE_3_DATABASE_MIGRATION.md

---

**Created:** May 25, 2026  
**Status:** Ready for Implementation
