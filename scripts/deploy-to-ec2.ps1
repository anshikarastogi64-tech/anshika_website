# Deploy Kelly app to AWS EC2
# Requires: $env:EC2_HOST, $env:EC2_USER, $env:EC2_KEY_PATH (or EC2_* in .env.deploy)
# Run from project root: .\scripts\deploy-to-ec2.ps1

$ErrorActionPreference = "Stop"

# Load from .env.deploy if it exists
if (Test-Path ".env.deploy") {
    Get-Content ".env.deploy" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$EC2_HOST = $env:EC2_HOST
$EC2_USER = $env:EC2_USER ?? "ubuntu"
$EC2_KEY = $env:EC2_KEY_PATH
$REMOTE_PATH = $env:EC2_APP_PATH ?? "/home/ubuntu/kelly-app"

if (-not $EC2_HOST) {
    Write-Host "Error: Set EC2_HOST (e.g. 3.25.100.50 or ec2-xx-xx.compute.amazonaws.com)" -ForegroundColor Red
    Write-Host "Optional: EC2_USER, EC2_KEY_PATH, EC2_APP_PATH" -ForegroundColor Yellow
    Write-Host "Create .env.deploy or set env vars before running." -ForegroundColor Yellow
    exit 1
}

$target = "${EC2_USER}@${EC2_HOST}"

Write-Host "Deploying to $target ..." -ForegroundColor Cyan

# Sync files via rsync (Git Bash) or scp
$rsync = Get-Command rsync -ErrorAction SilentlyContinue
if ($rsync) {
    $excludes = "--exclude=node_modules --exclude=.env --exclude=.git --exclude=logs --exclude=*.log --exclude=data.sqlite --exclude=Kelly/data.sqlite"
    # -T disables pseudo-TTY (fixes stty/ioctl errors on Windows)
    $sshOpts = "-o StrictHostKeyChecking=no -o BatchMode=yes -T"
    if ($EC2_KEY) { $env:RSYNC_RSH = "ssh -i `"$EC2_KEY`" $sshOpts" } else { $env:RSYNC_RSH = "ssh $sshOpts" }
    rsync -avz $excludes.Split() ./ "${target}:${REMOTE_PATH}/"
} else {
    Write-Host "rsync not found. Using scp (copies everything - slower)..." -ForegroundColor Yellow
    if (-not $EC2_KEY) {
        Write-Host "Error: EC2_KEY_PATH required when rsync is not available" -ForegroundColor Red
        exit 1
    }
    # Copy Kelly excluding data.sqlite (preserves production DB)
    $tmpBase = Join-Path $env:TEMP "kelly-deploy-$(Get-Random)"
    New-Item -ItemType Directory -Path "$tmpBase\Kelly" -Force | Out-Null
    robocopy "Kelly" "$tmpBase\Kelly" /E /XD .git /XF data.sqlite /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    $items = @("server.js", "package.json", "ecosystem.config.cjs", "db.js", "views")
    if (Test-Path "package-lock.json") { $items += "package-lock.json" }
    scp -i $EC2_KEY -r -o StrictHostKeyChecking=no @items "${target}:${REMOTE_PATH}/"
    scp -i $EC2_KEY -r -o StrictHostKeyChecking=no "$tmpBase\Kelly" "${target}:${REMOTE_PATH}/"
    Remove-Item -Recurse -Force $tmpBase -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Restart PM2 on EC2
$remoteCmd = "cd $REMOTE_PATH && npm ci --omit=dev 2>/dev/null || npm install --omit=dev && mkdir -p logs Kelly/assets/uploads/recordings Kelly/assets/uploads/womens-day && pm2 restart kelly-designers-vision 2>/dev/null || pm2 start ecosystem.config.cjs --env production && pm2 save"
$sshArgs = @("-o", "StrictHostKeyChecking=no", "$target", $remoteCmd)
if ($EC2_KEY) { $sshArgs = @("-i", $EC2_KEY) + $sshArgs }
& ssh @sshArgs

Write-Host "Deploy complete." -ForegroundColor Green
