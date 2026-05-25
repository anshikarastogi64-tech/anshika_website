# Phase 4-10: Implementation Guide

Complete implementation guide for remaining phases.

---

## Phase 4: Implement S3 File Upload Functionality

**Duration:** 3-4 days  
**Risk:** Medium

### Quick Steps:

1. **Update Multer Configuration**
```javascript
// In server.js - Replace current multer setup
const multer = require('multer');
const { uploadFile } = require('./lib/s3-upload');

const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for S3
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
```

2. **Update Upload Routes**
```javascript
// Example: Portfolio image upload
app.post('/admin/upload-portfolio', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    const s3Key = `portfolio/${Date.now()}-${file.originalname}`;
    const localPath = path.join(__dirname, 'Kelly/assets/img/portfolio', file.originalname);

    // Upload with dual-write
    const result = await uploadFile(file, s3Key, localPath);

    res.json({ success: true, url: result.url, s3Url: result.s3Url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

3. **Update Image Serving Logic**
```javascript
// Helper to get image URL
function getImageUrl(s3Key, localPath) {
  if (process.env.USE_S3 === 'true' && s3Key) {
    return `https://${process.env.AWS_S3_BUCKET_PROD}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
  }
  return localPath || '';
}
```

4. **Test Upload**
```bash
# Test script
node scripts/test-upload.js
```

### Success Criteria:
- [ ] Files upload to S3
- [ ] Files also saved locally (dual-write)
- [ ] URLs work correctly
- [ ] Existing local files still accessible
- [ ] Error handling works

---

## Phase 5: Migrate Existing Files to S3

**Duration:** 2-3 days  
**Risk:** Low (non-destructive)

### Migration Script:

Create `scripts/migrate-files-to-s3.js`:
```javascript
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { uploadToS3 } = require('../lib/s3-upload');

const SOURCE_DIR = path.join(__dirname, '../Kelly/assets/img');
const BATCH_SIZE = 50;

async function migrateFiles() {
  console.log('📁 Migrating files to S3...\n');

  const files = getAllFiles(SOURCE_DIR);
  console.log(`Found ${files.length} files to migrate\n`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}...`);

    for (const file of batch) {
      try {
        const relativePath = path.relative(SOURCE_DIR, file);
        const s3Key = `kelly-assets/${relativePath.replace(/\\/g, '/')}`;
        
        const content = fs.readFileSync(file);
        const contentType = getContentType(file);

        await uploadToS3(content, s3Key, contentType);
        console.log(`✅ ${relativePath}`);
        successful++;

      } catch (error) {
        console.error(`❌ ${file}: ${error.message}`);
        failed++;
      }
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`Success: ${successful}, Failed: ${failed}`);
}

function getAllFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  });

  return files;
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
  };
  return types[ext] || 'application/octet-stream';
}

migrateFiles();
```

### Run Migration:
```bash
node scripts/migrate-files-to-s3.js
```

### Verification:
```bash
# Check S3 bucket
aws s3 ls s3://anshika-designers-vision-prod/kelly-assets/ --recursive | wc -l

# Should match local file count
find Kelly/assets/img -type f | wc -l
```

---

## Phase 6: Migrate Database to PostgreSQL

**Duration:** 2-3 days  
**Risk:** Medium

### Steps:

1. **Run Migration Script** (created in Phase 3)
```bash
node scripts/migrate-database.js
```

2. **Verify Data**
```bash
node scripts/verify-migration.js
```

3. **Update .env**
```bash
USE_POSTGRES=false  # Keep false until Phase 7
```

### Success Criteria:
- [ ] All tables migrated
- [ ] Row counts match
- [ ] Queries work
- [ ] No data loss

---

## Phase 7: Update Application Code for PostgreSQL

**Duration:** 4-5 days  
**Risk:** High (production changes)

### Code Updates Required:

#### 1. Update db.js
```javascript
// At top of db.js
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

if (USE_POSTGRES) {
  module.exports = require('./lib/db-postgres');
} else {
  // Existing SQLite code
  module.exports = require('./lib/db-sqlite'); // Create this wrapper
}
```

#### 2. Update Query Syntax
```javascript
// OLD (SQLite)
db.run('INSERT INTO users (name) VALUES (?)', [name], function(err) {
  const id = this.lastID;
});

// NEW (PostgreSQL)
const result = await db.query(
  'INSERT INTO users (name) VALUES ($1) RETURNING id',
  [name]
);
const id = result.rows[0].id;
```

#### 3. Update All Routes
Search for:
- `db.run(` → Convert to `await db.query()`
- `db.get(` → Convert to `await db.getOne()`
- `db.all(` → Convert to `await db.getAll()`
- `?` placeholders → `$1, $2, $3` placeholders

#### 4. Test Each Route
```bash
# Create test script
node scripts/test-all-routes.js
```

### Gradual Rollout:
1. Test in staging with `USE_POSTGRES=true`
2. Monitor logs for errors
3. Fix any issues
4. Deploy to production

---

## Phase 8: Testing and Validation

**Duration:** 4-5 days  
**Risk:** Low

### Test Plan:

#### 1. Unit Tests
```bash
npm test
```

#### 2. Integration Tests
- File upload/download
- Database CRUD operations
- Authentication
- Portal functionality

#### 3. Performance Tests
```bash
# Load test with 50 concurrent users
node scripts/load-test.js
```

#### 4. User Acceptance Testing
- Login as admin
- Login as client
- Upload files
- View projects
- Test all portal features

#### 5. Rollback Test
```bash
# Switch back to SQLite
USE_POSTGRES=false
USE_S3=false
pm2 restart kelly-designers-vision
```

### Success Criteria:
- [ ] All tests pass
- [ ] Performance acceptable (<2s page load)
- [ ] No errors in logs
- [ ] Rollback works
- [ ] Client portal fully functional

---

## Phase 9: Deploy to Production

**Duration:** 2-3 days  
**Risk:** High

### Pre-Deployment Checklist:
- [ ] All tests passing
- [ ] Backup created
- [ ] Rollback plan ready
- [ ] Monitoring in place
- [ ] Team notified

### Deployment Steps:

1. **Maintenance Mode (Optional)**
```bash
# Create maintenance.html in public/
echo "<h1>Upgrading...</h1>" > Kelly/maintenance.html
```

2. **Stop Application**
```bash
pm2 stop kelly-designers-vision
```

3. **Pull Latest Code**
```bash
cd ~/kelly-app
git pull origin Live_backup_Update_ReDesign
npm install
```

4. **Update Environment**
```bash
nano .env
# Set:
USE_S3=true
USE_POSTGRES=true
MIGRATION_MODE=s3-only
```

5. **Start Application**
```bash
pm2 start kelly-designers-vision
pm2 logs --lines 50
```

6. **Monitor for 30 Minutes**
- Check error logs
- Test critical features
- Monitor AWS costs

7. **Verify Success**
```bash
curl http://localhost:8000
# Should return homepage
```

### Rollback (if needed):
```bash
pm2 stop kelly-designers-vision
git reset --hard HEAD~1
nano .env  # Set USE_S3=false, USE_POSTGRES=false
npm install
pm2 start kelly-designers-vision
```

---

## Phase 10: Setup CloudFront CDN (Optional)

**Duration:** 2-3 days  
**Risk:** Low

### Quick Setup:

1. **Create CloudFront Distribution**
- Go to CloudFront console
- Create distribution
- Origin: S3 bucket
- Cache policy: CachingOptimized

2. **Update URLs**
```javascript
// In lib/s3-upload.js
const CDN_URL = process.env.CDN_URL; // https://dxxxxx.cloudfront.net

function getFileUrl(s3Key) {
  if (CDN_URL) {
    return `${CDN_URL}/${s3Key}`;
  }
  return `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}
```

3. **Test CDN**
```bash
curl https://dxxxxx.cloudfront.net/kelly-assets/test.jpg
```

### Benefits:
- Faster global access
- Reduced S3 costs
- Better performance

---

## 🎯 Final Checklist

### Phase 4 ✅
- [ ] Multer configured for S3
- [ ] Upload routes updated
- [ ] Dual-write working
- [ ] Tests passing

### Phase 5 ✅
- [ ] All files migrated to S3
- [ ] Verification complete
- [ ] URLs updated
- [ ] Local files kept as backup

### Phase 6 ✅
- [ ] Database migrated
- [ ] Row counts verified
- [ ] Indexes created
- [ ] Queries tested

### Phase 7 ✅
- [ ] Code updated for PostgreSQL
- [ ] All routes converted
- [ ] Tests passing
- [ ] Staging tested

### Phase 8 ✅
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Performance acceptable
- [ ] UAT complete
- [ ] Rollback tested

### Phase 9 ✅
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] No errors
- [ ] Client portal working

### Phase 10 ✅
- [ ] CloudFront configured
- [ ] CDN tested
- [ ] URLs updated
- [ ] Performance improved

---

## 📊 Post-Migration Tasks

### Week 1 After Launch:
- Monitor AWS costs daily
- Check error logs hourly
- Test all features
- Gather user feedback

### Week 2-4:
- Optimize queries
- Tune cache settings
- Review performance
- Delete old local files (after 30 days)

### Month 2:
- Remove SQLite dependency
- Clean up old code
- Update documentation
- Celebrate success! 🎉

---

## 💰 Cost Monitoring

### Daily Checks:
```bash
# Check AWS costs
aws ce get-cost-and-usage --time-period Start=2026-05-01,End=2026-05-31
```

### Set Billing Alerts:
- Alert at ₹500
- Alert at ₹1,000
- Alert at ₹2,000

### Optimize Costs:
- Use S3 Lifecycle (move to Glacier after 90 days)
- Enable S3 Intelligent-Tiering
- Use Reserved RDS instance (40% savings)

---

## 🆘 Emergency Contacts

**AWS Support:**
- Console: https://console.aws.amazon.com/support
- Phone: (Check AWS console for your region)

**Database Issues:**
- RDS console
- Check security groups
- Review CloudWatch metrics

**S3 Issues:**
- S3 console
- Check bucket policies
- Verify IAM permissions

---

## ✨ Success Metrics

**Technical:**
- ✅ 99.9% uptime
- ✅ <2s page load
- ✅ <100ms queries
- ✅ 1000+ concurrent users supported

**Business:**
- ✅ Zero data loss
- ✅ Zero client complaints
- ✅ Scalable infrastructure
- ✅ Professional grade

---

**Migration Complete!** 🎉🚀

Your website is now running on:
- ✅ AWS S3 (unlimited storage)
- ✅ PostgreSQL (scalable database)
- ✅ CloudFront (global CDN)
- ✅ Professional infrastructure

**Ready for growth!**

---

**Created:** May 25, 2026  
**Status:** Complete Implementation Guide
