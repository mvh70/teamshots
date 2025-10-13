# Deployment Guide - TeamShots on Hetzner VPS with Coolify

This guide covers deploying TeamShots to a Hetzner VPS using Coolify for container orchestration and CI/CD.

## Overview

- **Hosting**: Hetzner Cloud VPS
- **Server IP**: 94.130.225.35
- **Orchestration**: Coolify (Docker-based)
- **SSL**: Automatic via Let's Encrypt
- **Domains**: www.teamshots.vip, app.teamshots.vip
- **Database**: PostgreSQL (containerized via Coolify)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Hetzner VPS Setup](#hetzner-vps-setup)
3. [DNS Configuration](#dns-configuration)
4. [Coolify Installation](#coolify-installation)
5. [Database Setup](#database-setup)
6. [Application Deployment](#application-deployment)
7. [Environment Variables](#environment-variables)
8. [SSL Configuration](#ssl-configuration)
9. [CI/CD Setup](#cicd-setup)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- [ ] Domain registered (teamshots.vip)
- [ ] GitHub repository set up
- [ ] Resend account for emails
- [ ] Basic understanding of Docker
- [ ] SSH key for server access

---

## Hetzner VPS Setup

### 1. Create Hetzner Cloud Server

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. Create new project: "TeamShots Production"
3. Add new server with these specs:

**Recommended Configuration:**
- **Location**: Nuremberg, Germany (or closest to your users)
- **Image**: Ubuntu 22.04 LTS
- **Type**: CPX21 (3 vCPU, 4GB RAM, 80GB SSD) - ~€8/month
- **Networking**: IPv4 & IPv6
- **SSH Keys**: Add your public SSH key
- **Firewall**: Create with rules:
  - Allow SSH (22) from your IP
  - Allow HTTP (80) from anywhere
  - Allow HTTPS (443) from anywhere

### 2. Initial Server Setup

SSH into your server:

```bash
ssh root@94.130.225.35
```

Update the system:

```bash
apt update && apt upgrade -y
apt install -y curl wget git
```

Create a non-root user (optional but recommended):

```bash
adduser deploy
usermod -aG sudo deploy
```

### 3. Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker
```

Verify:
```bash
docker --version
docker ps
```

---

## DNS Configuration

Configure DNS records at your domain registrar. See [DNS_SETUP.md](./DNS_SETUP.md) for detailed instructions.

**Required A Records:**
```
@ (root)     →  94.130.225.35
www          →  94.130.225.35
app          →  94.130.225.35
```

Verify DNS propagation:
```bash
dig www.teamshots.vip +short
dig app.teamshots.vip +short
```

Both should return: `94.130.225.35`

---

## Coolify Installation

### 1. Install Coolify

SSH into your server and run:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This will:
- Install Coolify and its dependencies
- Start Coolify on port 8000
- Create initial admin user

### 2. Access Coolify Dashboard

1. Open browser: `http://94.130.225.35:8000`
2. Complete initial setup wizard
3. Set admin password (save this securely!)
4. Configure email notifications (optional)

### 3. Secure Coolify Dashboard

Once inside Coolify:
1. Go to **Settings** → **Configuration**
2. Enable **Automatic SSL** for the dashboard
3. Set custom domain for Coolify: `coolify.teamshots.vip` (optional)
4. Configure firewall to restrict port 8000 access

---

## Database Setup

### 1. Create PostgreSQL Database in Coolify

1. In Coolify dashboard, go to **Databases**
2. Click **+ Add Database**
3. Select **PostgreSQL 16**
4. Configure:
   - **Name**: teamshots-db
   - **Database Name**: teamshots
   - **Username**: teamshots_user
   - **Password**: [Generate strong password]
   - **Port**: 5432 (internal)
5. Click **Deploy**

### 2. Get Database Connection String

Once deployed, Coolify will provide the internal connection string:

```
postgresql://teamshots_user:[PASSWORD]@teamshots-db:5432/teamshots
```

**Note**: This uses Docker networking. The database is only accessible from other containers on the same network.

### 3. Run Prisma Migrations

After the app is deployed, you'll need to run migrations. This can be done via:

**Option A: Coolify Console**
1. Go to your app in Coolify
2. Click **Console**
3. Run: `npx prisma migrate deploy`

**Option B: SSH into server**
```bash
docker exec -it [container-name] npx prisma migrate deploy
```

---

## Application Deployment

### 1. Create New Application in Coolify

1. In Coolify dashboard, go to **Projects**
2. Click **+ Add Project** → "TeamShots Production"
3. Click **+ Add Resource** → **Application**
4. Select **GitHub** as source
5. Connect your GitHub account
6. Select repository: `yourusername/teamshots`
7. Configure:
   - **Branch**: main
   - **Build Pack**: Dockerfile
   - **Port**: 3000
   - **Domains**: 
     - `www.teamshots.vip`
     - `app.teamshots.vip`

### 2. Configure Build Settings

In the application settings:

**Build Configuration:**
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `.`
- **Build Arguments**: (none needed)

**Deployment:**
- **Auto Deploy**: Enable (deploys on git push)
- **Health Check Path**: `/api/health` (we'll create this)
- **Restart Policy**: unless-stopped

### 3. Add Health Check Endpoint

Create a health check endpoint for Coolify to verify the app is running:

**File**: `src/app/api/health/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
```

---

## Environment Variables

### 1. Configure in Coolify

In your application settings → **Environment Variables**, add:

```bash
# Database
DATABASE_URL="postgresql://teamshots_user:[PASSWORD]@teamshots-db:5432/teamshots"

# Resend Email
RESEND_API_KEY="re_..."

# Base URL
NEXT_PUBLIC_BASE_URL="https://www.teamshots.vip"

# NextAuth (for Task 2)
NEXTAUTH_URL="https://www.teamshots.vip"
NEXTAUTH_SECRET="[generate with: openssl rand -base64 32]"

# Node Environment
NODE_ENV="production"
```

### 2. Sensitive Variables

For sensitive data:
1. Use Coolify's built-in secrets manager
2. Mark variables as "Secret" (hidden in UI)
3. Never commit to git

### 3. Environment-Specific Values

Coolify supports multiple environments. Create separate apps for:
- **Production**: www.teamshots.vip
- **Staging**: staging.teamshots.vip (optional)
- **Development**: Local only

---

## SSL Configuration

### Automatic SSL (Recommended)

Coolify automatically provisions SSL certificates via Let's Encrypt:

1. Ensure DNS is pointing to your server
2. In application settings, enable **Automatic SSL**
3. Coolify will:
   - Request certificates from Let's Encrypt
   - Auto-renew before expiration
   - Force HTTPS redirects

### Manual SSL (Alternative)

If you have custom certificates:

1. Go to application settings → **SSL/TLS**
2. Upload:
   - Certificate file (.crt)
   - Private key file (.key)
   - Chain file (if applicable)

### Verify SSL

```bash
# Check certificate
curl -vI https://www.teamshots.vip

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/
```

---

## CI/CD Setup

### Automatic Deployment (GitHub Integration)

Coolify automatically deploys on git push when configured:

1. **Enable Auto Deploy** in application settings
2. **Webhook** is automatically created in GitHub
3. On push to `main` branch:
   - Coolify pulls latest code
   - Builds Docker image
   - Runs health checks
   - Deploys with zero downtime

### Manual Deployment

Via Coolify dashboard:
1. Go to application
2. Click **Deploy** button
3. Select branch/commit to deploy

Via CLI (after installing Coolify CLI):
```bash
coolify deploy teamshots-production
```

### Deployment Pipeline

```
git push origin main
    ↓
GitHub Webhook
    ↓
Coolify receives hook
    ↓
Pull latest code
    ↓
Build Docker image
    ↓
Run Prisma migrations
    ↓
Health check
    ↓
Deploy (rolling update)
    ↓
Success ✅
```

### Rollback

If deployment fails:
1. Go to **Deployments** history
2. Select previous working deployment
3. Click **Redeploy**

---

## Monitoring & Maintenance

### Coolify Built-in Monitoring

- **Logs**: Real-time container logs
- **Metrics**: CPU, RAM, Network usage
- **Uptime**: Application availability
- **Alerts**: Email/Slack notifications

### Database Backups

**Automated Backups (Recommended):**
1. In Coolify → Databases → teamshots-db
2. Enable **Automated Backups**
3. Configure:
   - **Frequency**: Daily at 3 AM
   - **Retention**: 7 days
   - **Storage**: S3-compatible (optional)

**Manual Backup:**
```bash
docker exec teamshots-db pg_dump -U teamshots_user teamshots > backup.sql
```

**Restore from Backup:**
```bash
docker exec -i teamshots-db psql -U teamshots_user teamshots < backup.sql
```

### Application Updates

1. **Dependencies**: Update package.json locally, test, then deploy
2. **Database Schema**: Run migrations locally first, then production
3. **Environment Variables**: Update in Coolify UI

### Server Maintenance

```bash
# Update system packages
apt update && apt upgrade -y

# Clean Docker
docker system prune -a

# Check disk space
df -h

# Check memory
free -h

# Monitor processes
htop
```

---

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

**Symptoms**: Container crashes immediately

**Debug Steps:**
```bash
# View logs in Coolify or:
docker logs [container-id]

# Common causes:
# - Missing environment variables
# - Database connection failed
# - Port already in use
```

#### 2. SSL Certificate Issues

**Symptoms**: Certificate not provisioning

**Solutions:**
- Verify DNS points to server (wait 15 min for propagation)
- Check port 80/443 are open in firewall
- Ensure domain is correctly configured in Coolify
- Check Let's Encrypt rate limits

#### 3. Database Connection Fails

**Symptoms**: "Can't connect to database" errors

**Debug:**
```bash
# Check database is running
docker ps | grep postgres

# Test connection from app container
docker exec -it [app-container] psql $DATABASE_URL

# Check connection string format
echo $DATABASE_URL
```

#### 4. Deployment Stuck/Hanging

**Solutions:**
- Check build logs for errors
- Verify Dockerfile builds locally
- Increase build timeout in Coolify
- Check disk space: `df -h`

#### 5. Domain Not Resolving

**Debug:**
```bash
# Check DNS
dig www.teamshots.vip +short

# Check server is listening
netstat -tulpn | grep :443

# Test locally
curl -I http://94.130.225.35:3000
```

### Getting Help

- **Coolify Docs**: https://coolify.io/docs
- **Coolify Discord**: https://coollabs.io/discord
- **Hetzner Support**: https://docs.hetzner.com/
- **TeamShots Issues**: Open GitHub issue

---

## Security Best Practices

### Server Security

- [ ] Keep system updated: `apt update && apt upgrade`
- [ ] Configure firewall (UFW or Hetzner firewall)
- [ ] Disable root SSH login
- [ ] Use SSH keys (disable password auth)
- [ ] Enable fail2ban for brute force protection
- [ ] Regular security audits

### Application Security

- [ ] Environment variables in Coolify (never in code)
- [ ] Secrets marked as sensitive
- [ ] HTTPS only (force redirect)
- [ ] Security headers configured
- [ ] Regular dependency updates
- [ ] Database backups enabled

### Monitoring

- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure error tracking (Sentry)
- [ ] Enable Coolify alerts
- [ ] Monitor SSL expiration
- [ ] Track performance metrics

---

## Cost Estimate

**Monthly Costs (USD):**
- Hetzner VPS (CPX21): ~$9
- Domain (teamshots.vip): ~$12/year = $1/month
- Resend Email: Free tier (100/day) → $0
- Coolify: Free (self-hosted)
- **Total**: ~$10/month

**As you scale:**
- Upgrade VPS as needed
- Consider CDN (Cloudflare Free tier)
- Resend paid tier if >100 emails/day
- Database backups to S3 (~$1-5/month)

---

## Next Steps After Deployment

1. [ ] Verify all domains resolve correctly
2. [ ] Test waitlist signup and emails
3. [ ] Check SSL certificate is active
4. [ ] Run database migrations
5. [ ] Test language switching (EN/ES)
6. [ ] Set up monitoring/alerts
7. [ ] Configure automated backups
8. [ ] Document server access for team
9. [ ] Test auto-deployment (push to main)
10. [ ] Share live URL with team!

---

## Quick Command Reference

```bash
# SSH to server
ssh root@94.130.225.35

# View running containers
docker ps

# View application logs
docker logs -f [container-name]

# Restart application
docker restart [container-name]

# Database backup
docker exec teamshots-db pg_dump -U teamshots_user teamshots > backup.sql

# Enter database
docker exec -it teamshots-db psql -U teamshots_user teamshots

# Run migrations
docker exec -it [app-container] npx prisma migrate deploy

# Check disk space
df -h

# Update system
apt update && apt upgrade -y
```

---

**Deployment Status**: ✅ Ready to deploy once DNS is configured and Coolify is installed!

