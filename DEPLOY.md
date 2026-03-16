# Deploy to AWS EC2

## Prerequisites

- AWS EC2 instance (Ubuntu 22.04 or Amazon Linux 2)
- Security group: allow inbound ports **22** (SSH), **80** (HTTP), **443** (HTTPS)
- Elastic IP (recommended for stable public IP)

---

## Automatic Deployment (GitHub Actions)

Deploy automatically to EC2 whenever you push to `main`.

### One-time setup

1. **Initialize Git & push to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

2. **Initial EC2 setup**: SSH into EC2 and clone the repo:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   cd /home/ubuntu
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git kelly-app
   cd kelly-app
   cp .env.example .env && nano .env
   npm install --production
   mkdir -p logs Kelly/assets/uploads/recordings Kelly/assets/uploads/womens-day Kelly/assets/uploads/portal
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   pm2 startup
   ```

3. **Add GitHub Secrets**: Repo → Settings → Secrets and variables → Actions → New repository secret:
   - `EC2_HOST` — EC2 public IP or DNS (e.g. `3.25.100.50`)
   - `EC2_USER` — SSH user (usually `ubuntu`)
   - `SSH_PRIVATE_KEY` — Full contents of your `.pem` file (copy/paste, including `-----BEGIN/END-----` lines)

### Deploy from Cursor

After setup, from Cursor's terminal:

```bash
git add -A && git commit -m "Your changes" && npm run deploy
```

Or: commit and push to `main` — GitHub Actions deploys automatically.

---

## Manual Deployment (Direct from Cursor)

Run a direct deploy without using Git:

1. Copy `.env.deploy.example` to `.env.deploy` and fill in your EC2 details.
2. Run:
   ```bash
   npm run deploy:direct
   ```
   Or: `pwsh -File scripts/deploy-to-ec2.ps1`

Requires `rsync` (from Git for Windows) or OpenSSH `scp` on your machine.

**Database safety:** Both deploy methods preserve `data.sqlite` (project root) and `Kelly/data.sqlite` (PHP) on the server—they are never overwritten.

---

## 1. SSH into EC2

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

---

## 2. Install Node.js (Ubuntu)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should show v20.x
```

---

## 3. Install PM2 (process manager)

```bash
sudo npm install -g pm2
```

---

## 4. Upload your project

**Option A: Git**

```bash
cd /home/ubuntu
git clone <your-repo-url> kelly-app
cd kelly-app
```

**Option B: SCP/SFTP**

```bash
# From your local machine:
scp -i your-key.pem -r "Kelly 2" ubuntu@your-ec2-ip:/home/ubuntu/kelly-app
```

---

## 5. Configure environment

```bash
cd /home/ubuntu/kelly-app
cp .env.example .env
nano .env
```

Set production values:

```
PORT=8000
NODE_ENV=production
SESSION_SECRET=generate-a-long-random-string-here
SESSION_SECURE=true
```

Generate a secret: `openssl rand -hex 32`

---

## 6. Install dependencies and run

```bash
npm install --production
mkdir -p logs Kelly/assets/uploads/recordings Kelly/assets/uploads/womens-day Kelly/assets/uploads/portal
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # run the command it outputs to survive reboots
```

---

## 7. (Optional) Nginx reverse proxy

To serve on port 80 and add SSL later:

```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/default
```

Replace contents with:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. (Optional) SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

Set `SESSION_SECURE=true` in `.env` when using HTTPS.

---

## Commands

| Command | Description |
|--------|-------------|
| `pm2 status` | Check app status |
| `pm2 logs` | View logs |
| `pm2 restart kelly-designers-vision` | Restart app |
| `pm2 stop kelly-designers-vision` | Stop app |

---

## Default admin login

After first run: **admin** / **Admin@123**  
Change the password via admin panel after deployment.

---

## Updating the Portal on the web (anshikarastogi.com)

No **new** installations are required to update the portal. The same stack runs both the main site and the portal.

### What you need on the server (already there if the site is live)

| Requirement | Notes |
|-------------|--------|
| **Node.js** | v18 or higher (v20 recommended). Check: `node -v` |
| **npm dependencies** | Same as main app: `npm install --production` or `npm ci --omit=dev` |
| **Database** | Single SQLite file `data.sqlite` in the project root. New portal tables are created automatically on startup. |
| **Uploads directory** | `Kelly/assets/uploads/portal` — created by the app on first portal upload, or create manually: `mkdir -p Kelly/assets/uploads/portal` |

### Environment variables (in `.env` on the server)

- **Required for sessions:** `SESSION_SECRET` (use a long random string in production).
- **If the site uses HTTPS:** `SESSION_SECURE=true`.
- **Optional (portal emails):** `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` (or `SMTP_*` equivalents).

No new env vars are required for recent portal features (daily updates, mobile layout, etc.).

### How to deploy the update

1. **If you use GitHub Actions:** Push your changes to `main`. The workflow will pull on EC2, run `npm ci --omit=dev`, ensure upload dirs exist, and restart PM2.
2. **If you deploy manually:**  
   - Pull the latest code (or rsync/scp the project).  
   - On the server: `cd /home/ubuntu/kelly-app` (or your app path), then:
     ```bash
     npm ci --omit=dev
     mkdir -p Kelly/assets/uploads/portal
     pm2 restart kelly-designers-vision
     pm2 save
     ```

The portal is served under the same domain (e.g. **anshikarastogi.com/portal/login**). No separate installation or subdomain is needed.
