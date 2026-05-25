# AWS Setup Guide - Phase 1
## Step-by-Step Instructions for Infrastructure Setup

---

## Prerequisites

- [ ] AWS Account (if not created, go to aws.amazon.com and sign up)
- [ ] Credit/Debit card for AWS billing
- [ ] SSH access to your EC2 server
- [ ] Basic understanding of AWS console

---

## Step 1: AWS Account Setup (If New)

### 1.1 Create AWS Account
1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Enter email, password, AWS account name
4. Select "Personal" account type
5. Enter billing information
6. Verify phone number
7. Choose "Free" support plan

### 1.2 Enable MFA (Multi-Factor Authentication)
1. Go to IAM Dashboard → Security credentials
2. Click "Activate MFA"
3. Use Google Authenticator or similar app
4. Scan QR code and enter two consecutive codes

---

## Step 2: Create IAM User

**⚠️ Never use root account for daily operations!**

### 2.1 Create IAM User
1. Go to IAM → Users → Add users
2. **User name:** `anshika-website-admin`
3. **Access type:** 
   - ✅ Programmatic access (for CLI/SDK)
   - ✅ AWS Management Console access
4. Set console password (custom or auto-generated)
5. **Permissions:** Attach existing policies directly
   - ✅ `AdministratorAccess` (for now; we'll restrict later)
6. Review and Create User

### 2.2 Save Credentials
**IMPORTANT:** Download and save these securely:
```
Access Key ID: AKIA...
Secret Access Key: wJalrXUt...
Console Login URL: https://YOUR-ACCOUNT-ID.signin.aws.amazon.com/console
```

**💾 Save to:** Local password manager (1Password, LastPass, etc.)

---

## Step 3: Create S3 Buckets

### 3.1 Production Bucket
1. Go to S3 → Create bucket
2. **Bucket name:** `anshika-designers-vision-prod`
   - Must be globally unique
   - If taken, try: `anshika-designers-vision-prod-2026`
3. **Region:** `ap-south-1` (Mumbai - closest to your server)
4. **Block Public Access:** Keep all enabled (we'll use pre-signed URLs)
5. **Bucket Versioning:** Enable (for file history)
6. **Encryption:** Enable (SSE-S3)
7. **Object Lock:** Disable
8. Click "Create bucket"

### 3.2 Staging Bucket
Repeat above with:
- **Bucket name:** `anshika-designers-vision-staging`
- Same settings

### 3.3 Backup Bucket
Repeat above with:
- **Bucket name:** `anshika-designers-vision-backups`
- **Lifecycle rule:** Move to Glacier after 30 days
- Same other settings

### 3.4 Configure CORS (For each bucket)
1. Go to bucket → Permissions → CORS
2. Add this configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": [
            "http://anshikarastogi.com",
            "https://anshikarastogi.com",
            "http://15.206.166.28",
            "http://localhost:8000"
        ],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

3. Save changes

### 3.5 Create Folder Structure in Production Bucket
1. Open `anshika-designers-vision-prod` bucket
2. Click "Create folder" for each:
   - `portfolio/`
   - `testimonials/`
   - `services/`
   - `projects/`
   - `users/`
   - `cctv/`
   - `documents/`

---

## Step 4: Create RDS PostgreSQL Database

### 4.1 Create Database
1. Go to RDS → Create database
2. **Engine type:** PostgreSQL
3. **Version:** PostgreSQL 15.x (latest stable)
4. **Templates:** Free tier (if eligible) OR Production
5. **DB instance identifier:** `anshika-website-db`

### 4.2 Settings
- **Master username:** `anshika_admin`
- **Master password:** (Generate strong password, save it!)
  - Example: `AnShIkA_2026_SecureDB#789`
  - **💾 Save this password securely!**

### 4.3 Instance Configuration
- **DB instance class:** `db.t3.micro` (1 vCPU, 1GB RAM)
  - Cost: ~₹1,200/month
  - Good for 100+ concurrent users

### 4.4 Storage
- **Storage type:** General Purpose SSD (gp3)
- **Allocated storage:** 20 GB
- **Enable storage autoscaling:** Yes
- **Maximum storage threshold:** 100 GB

### 4.5 Connectivity
- **VPC:** Default VPC
- **Subnet group:** Default
- **Public access:** **YES** (so your EC2 can connect)
  - ⚠️ We'll restrict access via Security Groups
- **VPC security group:** Create new
  - Name: `anshika-website-db-sg`
- **Availability Zone:** No preference
- **Database port:** 5432 (default)

### 4.6 Database Authentication
- **Password authentication:** Enabled
- **IAM database authentication:** Disabled (optional later)

### 4.7 Additional Configuration
- **Initial database name:** `anshika_website_db`
- **DB parameter group:** default.postgres15
- **Backup retention:** 7 days
- **Backup window:** 03:00-04:00 UTC (9:30 AM IST - low traffic)
- **Enable automatic backups:** Yes
- **Enable encryption:** Yes (default AWS key)
- **Performance Insights:** Enable (free for 7 days retention)
- **Monitoring:** Enable Enhanced Monitoring (60-second granularity)
- **Maintenance window:** Sun 04:00-05:00 UTC (9:30 AM Sunday IST)

### 4.8 Create Database
1. Review all settings
2. Click "Create database"
3. **Wait 10-15 minutes** for creation

### 4.9 Save Database Credentials
Once created, note down:
```
Endpoint: anshika-website-db.xxxxxxxxx.ap-south-1.rds.amazonaws.com
Port: 5432
Database name: anshika_website_db
Username: anshika_admin
Password: [your password]
```

**Connection String:**
```
postgresql://anshika_admin:[PASSWORD]@anshika-website-db.xxxxxxxxx.ap-south-1.rds.amazonaws.com:5432/anshika_website_db
```

---

## Step 5: Configure Security Groups

### 5.1 Get Your EC2 Instance Security Group
1. Go to EC2 → Instances
2. Find your instance (ip-172-31-43-182)
3. Note the **Security Group ID** (e.g., `sg-xxxxxxxxx`)

### 5.2 Update RDS Security Group
1. Go to RDS → Databases → anshika-website-db
2. Click on the VPC security group
3. Edit inbound rules
4. Add rule:
   - **Type:** PostgreSQL
   - **Port:** 5432
   - **Source:** Custom → Select your EC2 security group
   - **Description:** Allow EC2 to connect to RDS
5. Save rules

### 5.3 Test RDS Connection from EC2
SSH to your server and test:
```bash
# Install PostgreSQL client
sudo apt update
sudo apt install postgresql-client -y

# Test connection (replace with your actual endpoint and password)
psql "postgresql://anshika_admin:YOUR_PASSWORD@anshika-website-db.xxxxxxxxx.ap-south-1.rds.amazonaws.com:5432/anshika_website_db"

# If successful, you should see:
# psql (15.x)
# Type "help" for help.
# anshika_website_db=>

# Exit with: \q
```

---

## Step 6: Create IAM Role for EC2

### 6.1 Create IAM Role
1. Go to IAM → Roles → Create role
2. **Trusted entity type:** AWS service
3. **Use case:** EC2
4. Click Next

### 6.2 Attach Permissions
Add these policies:
- ✅ `AmazonS3FullAccess`
- ✅ `CloudWatchLogsFullAccess` (for logging)

### 6.3 Name and Create
- **Role name:** `anshika-website-ec2-role`
- **Description:** Allows EC2 to access S3 and CloudWatch
- Click "Create role"

### 6.4 Attach Role to EC2 Instance
1. Go to EC2 → Instances
2. Select your instance
3. Actions → Security → Modify IAM role
4. Select `anshika-website-ec2-role`
5. Update IAM role

---

## Step 7: Install AWS CLI on Server

SSH to your server and run:

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
sudo apt install unzip -y
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version
# Should show: aws-cli/2.x.x

# Configure AWS CLI (not needed if using IAM role, but good for testing)
aws configure
# When prompted:
# AWS Access Key ID: [Your access key]
# AWS Secret Access Key: [Your secret key]
# Default region name: ap-south-1
# Default output format: json
```

### Test S3 Access
```bash
# List your buckets
aws s3 ls

# You should see:
# 2026-05-25 anshika-designers-vision-prod
# 2026-05-25 anshika-designers-vision-staging
# 2026-05-25 anshika-designers-vision-backups

# Test upload
echo "test file" > test.txt
aws s3 cp test.txt s3://anshika-designers-vision-staging/test.txt

# Test download
aws s3 cp s3://anshika-designers-vision-staging/test.txt downloaded.txt
cat downloaded.txt

# Cleanup
rm test.txt downloaded.txt
aws s3 rm s3://anshika-designers-vision-staging/test.txt
```

---

## Step 8: Update Environment Variables

### 8.1 Add to .env file on Server
SSH to server:
```bash
cd ~/kelly-app
nano .env
```

Add these variables:
```bash
# AWS Configuration
AWS_REGION=ap-south-1
AWS_S3_BUCKET_PROD=anshika-designers-vision-prod
AWS_S3_BUCKET_STAGING=anshika-designers-vision-staging
AWS_S3_BUCKET_BACKUPS=anshika-designers-vision-backups

# If not using IAM role, add:
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=wJalrXUt...

# PostgreSQL Database
DATABASE_URL=postgresql://anshika_admin:YOUR_PASSWORD@anshika-website-db.xxxxxxxxx.ap-south-1.rds.amazonaws.com:5432/anshika_website_db
DB_HOST=anshika-website-db.xxxxxxxxx.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=anshika_website_db
DB_USER=anshika_admin
DB_PASSWORD=YOUR_PASSWORD

# Migration Settings
MIGRATION_MODE=dual-write  # Options: dual-write, s3-only, local-only
USE_S3=true
USE_POSTGRES=false  # Start with false, enable after migration
```

Save and exit (Ctrl+X, Y, Enter)

### 8.2 Secure the .env File
```bash
chmod 600 ~/kelly-app/.env
```

---

## Step 9: Setup CloudWatch Alarms (Optional but Recommended)

### 9.1 Create SNS Topic for Alerts
1. Go to SNS (Simple Notification Service)
2. Create topic
   - **Name:** `anshika-website-alerts`
   - **Type:** Standard
3. Create subscription
   - **Protocol:** Email
   - **Endpoint:** your@email.com
4. Confirm subscription via email

### 9.2 Create CloudWatch Alarms

**RDS CPU Alarm:**
1. Go to CloudWatch → Alarms → Create alarm
2. Select metric → RDS → Per-Database Metrics
3. Select `CPUUtilization` for your database
4. **Threshold:** Greater than 80%
5. **Period:** 5 minutes
6. **Action:** Send to SNS topic `anshika-website-alerts`
7. Name: `anshika-db-high-cpu`

**RDS Storage Alarm:**
- Metric: `FreeStorageSpace`
- Threshold: Less than 2 GB
- Name: `anshika-db-low-storage`

**Billing Alarm:**
1. Go to CloudWatch → Billing (switch to us-east-1 region)
2. Create alarm for `EstimatedCharges`
3. Threshold: Greater than ₹3,000/month (or $40)
4. Action: Send to SNS

---

## Step 10: Verification Checklist

**Before proceeding to Phase 2, verify:**

- [ ] ✅ S3 buckets created (prod, staging, backups)
- [ ] ✅ S3 CORS configured
- [ ] ✅ S3 folder structure created
- [ ] ✅ RDS PostgreSQL instance running
- [ ] ✅ Can connect to RDS from EC2
- [ ] ✅ IAM role attached to EC2
- [ ] ✅ AWS CLI installed on server
- [ ] ✅ Can upload/download from S3
- [ ] ✅ Environment variables configured
- [ ] ✅ CloudWatch alarms set up
- [ ] ✅ All credentials saved securely

---

## 💰 Cost Summary (First Month)

After free tier:
- **S3 Storage (1GB):** ~₹2
- **S3 Requests:** ~₹10
- **Data Transfer:** ~₹50
- **RDS db.t3.micro:** ~₹1,200
- **RDS Storage (20GB):** ~₹200
- **Backups (7 days):** ~₹150
- **CloudWatch:** ~₹10
- **Total:** ~₹1,622/month

---

## 🚨 Important Notes

1. **Never commit credentials to git!** Always use .env file
2. **Enable MFA** on your AWS account
3. **Set billing alerts** to avoid surprises
4. **Regularly review AWS costs** in Billing Dashboard
5. **Keep backups** before any changes
6. **Test in staging** before production

---

## 📞 Support Resources

- **AWS Support:** https://aws.amazon.com/support
- **AWS Free Tier:** https://aws.amazon.com/free
- **AWS Documentation:** https://docs.aws.amazon.com
- **Pricing Calculator:** https://calculator.aws

---

## ✅ Phase 1 Complete!

Once all checklist items are verified, you're ready for:
**Phase 2: Install AWS SDK and Dependencies**

---

**Created:** May 25, 2026
**Status:** Ready for Implementation
