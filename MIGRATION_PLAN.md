# AWS S3 + RDS Migration Plan
## Anshika Website - Client Portal Infrastructure Upgrade

---

## 📊 Current State Analysis

**Total Storage:** 1013 MB (1 GB)
- Kelly/assets/img: 156 MB
- Database (SQLite): 1.1 MB
- Total Media Files: 1,016 files
- Node modules: ~800 MB

**Current Stack:**
- Database: SQLite3 (data.sqlite)
- File Storage: Local disk (Kelly/assets/img/)
- Server: AWS EC2 (Ubuntu)
- Framework: Node.js + Express + EJS

---

## 🎯 Migration Goals

1. ✅ **Unlimited Storage** - Move all files to AWS S3
2. ✅ **Better Reliability** - PostgreSQL instead of SQLite
3. ✅ **Automatic Backups** - AWS managed backups
4. ✅ **Better Performance** - CDN for global access
5. ✅ **Zero Client Impact** - Seamless migration
6. ✅ **Easy Scalability** - Handle 1000+ concurrent users

---

## 💰 Cost Estimate

### Monthly Costs:
- **S3 Storage** (10GB): ₹15/month
- **S3 Requests**: ₹10/month
- **Data Transfer**: ₹200/month
- **RDS PostgreSQL** (db.t3.micro): ₹1,200/month
- **RDS Storage** (20GB): ₹200/month
- **Automated Backups**: ₹150/month
- **CloudFront CDN** (optional): ₹800/month

**Total without CDN:** ~₹1,775/month (₹21,300/year)
**Total with CDN:** ~₹2,575/month (₹30,900/year)

---

## 📅 Timeline

**Total Duration:** 6-8 weeks (conservative, zero downtime)

| Phase | Duration | Key Activities |
|-------|----------|----------------|
| Phase 1: AWS Setup | Week 1 | Create accounts, configure S3, RDS |
| Phase 2: Dependencies | Week 1 | Install packages, test connections |
| Phase 3: DB Migration Scripts | Week 2 | Schema conversion, migration code |
| Phase 4: S3 Implementation | Week 2-3 | Dual-write, upload logic |
| Phase 5: File Migration | Week 3-4 | Copy existing files to S3 |
| Phase 6: DB Migration | Week 4 | Import data to PostgreSQL |
| Phase 7: Code Updates | Week 5 | Update all DB queries |
| Phase 8: Testing | Week 5-6 | Comprehensive testing |
| Phase 9: Production Deploy | Week 6 | Go live, monitor |
| Phase 10: CDN (Optional) | Week 7-8 | CloudFront setup |

---

## 🔐 Security Improvements

### Current Issues:
- ❌ No encryption at rest
- ❌ Files accessible if path is known
- ❌ No audit logs
- ❌ Database is a file on disk
- ❌ No automated backups

### After Migration:
- ✅ S3 encryption at rest (AES-256)
- ✅ Pre-signed URLs with expiration
- ✅ IAM roles and policies
- ✅ CloudTrail audit logs
- ✅ VPC isolation for database
- ✅ Automated daily backups
- ✅ Point-in-time recovery

---

## 📋 Phase Details

### Phase 1: AWS Infrastructure Setup
**Duration:** 2-3 days

**Checklist:**
- [ ] Create/verify AWS account
- [ ] Set up IAM user with admin access
- [ ] Create S3 buckets:
  - `anshika-designers-vision-prod`
  - `anshika-designers-vision-staging`
  - `anshika-designers-vision-backups`
- [ ] Configure bucket policies and CORS
- [ ] Create RDS PostgreSQL instance (db.t3.micro)
- [ ] Configure security groups (allow EC2 → RDS)
- [ ] Create IAM roles for EC2 to access S3
- [ ] Set up AWS credentials on server
- [ ] Test connectivity

**Deliverables:**
- AWS infrastructure ready
- Connection credentials saved in .env
- Documentation of resource ARNs

---

### Phase 2: Install Dependencies
**Duration:** 1 day

**Packages to Install:**
```json
{
  "aws-sdk": "^2.1691.0",
  "pg": "^8.13.1",
  "pg-pool": "^3.7.0",
  "multer-s3": "^3.0.1",
  "@aws-sdk/client-s3": "^3.699.0",
  "@aws-sdk/s3-request-presigner": "^3.699.0"
}
```

**Checklist:**
- [ ] Update package.json
- [ ] Install packages locally and on server
- [ ] Create lib/s3.js utility
- [ ] Create lib/db-pg.js for PostgreSQL
- [ ] Test S3 upload/download
- [ ] Test PostgreSQL connection
- [ ] Commit changes to git

---

### Phase 3: Database Migration Scripts
**Duration:** 3-4 days

**Checklist:**
- [ ] Export SQLite schema to SQL
- [ ] Convert SQLite → PostgreSQL syntax
- [ ] Create migration script (scripts/migrate-db.js)
- [ ] Add connection pooling
- [ ] Create backup script
- [ ] Test migration on local copy
- [ ] Document all schema changes

**Key Changes:**
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `TEXT` → `VARCHAR` or `TEXT`
- Add proper indexes
- Add foreign key constraints

---

### Phase 4: S3 Upload Implementation
**Duration:** 3-4 days

**Checklist:**
- [ ] Create S3 upload utility (lib/s3-upload.js)
- [ ] Implement dual-write logic (local + S3)
- [ ] Add pre-signed URL generation
- [ ] Update multer configuration
- [ ] Add fallback to local files
- [ ] Test upload flow in staging
- [ ] Update server.js routes

**File Structure in S3:**
```
s3://anshika-designers-vision-prod/
├── portfolio/
│   ├── project-name/
│   │   └── image.jpg
├── testimonials/
│   └── person-name.jpg
├── services/
│   └── service-image.jpg
├── projects/
│   └── {project-id}/
│       ├── designs/
│       ├── progress/
│       └── documents/
└── users/
    └── profiles/
```

---

### Phase 5: File Migration to S3
**Duration:** 2-3 days

**Checklist:**
- [ ] Create migration script (scripts/migrate-files-to-s3.js)
- [ ] Dry run to test
- [ ] Backup all files locally
- [ ] Run migration (Kelly/assets/img → S3)
- [ ] Verify all files copied
- [ ] Update URLs in database
- [ ] Test image loading on website
- [ ] Keep local files as backup (30 days)

**Migration Strategy:**
- Batch upload (100 files at a time)
- Maintain folder structure
- Generate mapping file (old-path → S3-URL)
- Log all transfers

---

### Phase 6: Database Migration
**Duration:** 2-3 days

**Checklist:**
- [ ] Create full backup of SQLite database
- [ ] Run migration script
- [ ] Import data to PostgreSQL
- [ ] Verify row counts match
- [ ] Test all queries
- [ ] Rebuild indexes
- [ ] Test foreign key constraints
- [ ] Keep SQLite as backup (30 days)

**Verification Queries:**
```sql
-- Compare counts
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM testimonials;
SELECT COUNT(*) FROM admins;
```

---

### Phase 7: Code Updates for PostgreSQL
**Duration:** 4-5 days

**Files to Update:**
- `db.js` - Main database module
- `server.js` - All route handlers
- `lib/portal.js` - Portal utilities
- All admin routes

**Pattern Changes:**
```javascript
// OLD (SQLite)
db.run('INSERT INTO...', [params], function(err) {
  const id = this.lastID;
});

// NEW (PostgreSQL)
const result = await pool.query(
  'INSERT INTO... RETURNING id',
  [params]
);
const id = result.rows[0].id;
```

**Checklist:**
- [ ] Update db.js with connection pool
- [ ] Convert all db.run() to pool.query()
- [ ] Convert all db.get() to pool.query()
- [ ] Convert all db.all() to pool.query()
- [ ] Add proper error handling
- [ ] Use parameterized queries ($1, $2 instead of ?)
- [ ] Test each updated route
- [ ] Update tests

---

### Phase 8: Testing
**Duration:** 4-5 days

**Test Plan:**

**File Operations:**
- [ ] Upload new image (saves to S3)
- [ ] View existing image (loads from S3)
- [ ] Download PDF (pre-signed URL)
- [ ] Upload large file (>5MB)
- [ ] Test fallback to local files

**Database Operations:**
- [ ] Create new project
- [ ] Update existing project
- [ ] Delete project (cascade)
- [ ] Login/authentication
- [ ] Test concurrent users (10+)
- [ ] Test transactions

**Client Portal:**
- [ ] Login as client
- [ ] View project dashboard
- [ ] View photos
- [ ] Upload documents
- [ ] Approve designs
- [ ] View CCTV footage
- [ ] View invoices

**Performance:**
- [ ] Page load time <2 seconds
- [ ] Image load time <1 second
- [ ] Database queries <100ms
- [ ] Concurrent user test (50 users)

**Rollback Test:**
- [ ] Switch back to SQLite
- [ ] Switch back to local files
- [ ] Verify everything works

---

### Phase 9: Production Deployment
**Duration:** 2-3 days

**Pre-Deployment:**
- [ ] Code review
- [ ] All tests passing
- [ ] Backup current production
- [ ] Update .env with production credentials
- [ ] Schedule maintenance window (if needed)

**Deployment Steps:**
1. [ ] Stop PM2 app
2. [ ] Pull latest code from git
3. [ ] Run `npm install`
4. [ ] Run database migration
5. [ ] Update environment variables
6. [ ] Start PM2 app
7. [ ] Monitor logs (30 minutes)
8. [ ] Test critical flows
9. [ ] Monitor performance (24 hours)

**Post-Deployment:**
- [ ] Verify all functionality
- [ ] Check error logs
- [ ] Monitor AWS costs
- [ ] Client communication (if any issues)
- [ ] Keep old backups for 30 days
- [ ] Document any issues

---

### Phase 10: CloudFront CDN (Optional)
**Duration:** 2-3 days

**Checklist:**
- [ ] Create CloudFront distribution
- [ ] Point to S3 origin
- [ ] Configure cache policies
- [ ] Add custom domain (if needed)
- [ ] SSL certificate setup
- [ ] Test global performance
- [ ] Update URLs in application
- [ ] Monitor cache hit ratio

---

## 🚨 Risk Mitigation

### Risk 1: Data Loss
**Mitigation:**
- Full backups before starting
- Dual-write period (30 days)
- Keep old systems intact
- Verification scripts

### Risk 2: Performance Issues
**Mitigation:**
- Load testing before go-live
- CloudFront CDN
- Connection pooling
- Monitoring and alerts

### Risk 3: Broken URLs
**Mitigation:**
- URL mapping table
- Fallback to local files
- Gradual migration
- Comprehensive testing

### Risk 4: Budget Overrun
**Mitigation:**
- S3 lifecycle policies
- Monitor AWS costs daily
- Set billing alerts
- Optimize file sizes

---

## 📊 Success Metrics

### Technical Metrics:
- ✅ 99.9% uptime
- ✅ Page load <2 seconds
- ✅ Database queries <100ms
- ✅ Zero data loss
- ✅ Support 500+ concurrent users

### Business Metrics:
- ✅ Zero client complaints
- ✅ Reduced manual backup time
- ✅ Scalability for growth
- ✅ Better disaster recovery

---

## 📚 Additional Resources

**AWS Documentation:**
- S3 Developer Guide
- RDS PostgreSQL Guide
- IAM Best Practices
- CloudFront Documentation

**Migration Tools:**
- AWS Database Migration Service
- AWS DataSync
- pgloader (SQLite → PostgreSQL)

**Monitoring:**
- AWS CloudWatch
- RDS Performance Insights
- S3 Storage Analytics

---

## 👥 Team Responsibilities

**Developer (Claude/You):**
- Code implementation
- Testing
- Deployment
- Documentation

**DevOps (If applicable):**
- AWS infrastructure setup
- Security configuration
- Monitoring setup

**Anshika:**
- Testing client portal
- User acceptance testing
- Client communication

---

## 📝 Notes

- Keep this document updated as migration progresses
- Document any issues/solutions
- Add lessons learned
- Update timeline if delays occur

---

**Created:** May 25, 2026
**Last Updated:** May 25, 2026
**Status:** Planning Phase
