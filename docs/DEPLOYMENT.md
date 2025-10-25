# Deployment Guide - TeamShots on Hetzner VPS with Coolify Cloud

This guide covers deploying TeamShots to a Hetzner VPS using Coolify Cloud (managed service) for container orchestration and CI/CD.

## Overview

- **Hosting**: Hetzner Cloud VPS
- **Server IP**: [Your server IP - update after creation]
- **Orchestration**: Coolify Cloud (managed service at app.coolify.io)
- **SSL**: Automatic via Let's Encrypt
- **Domains**: www.teamshots.vip, app.teamshots.vip
- **Database**: PostgreSQL (containerized via Coolify Cloud)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Hetzner VPS Setup](#hetzner-vps-setup)
3. [DNS Configuration](#dns-configuration)
4. [Cloudflare Setup (Optional)](#cloudflare-setup-optional-but-recommended)
5. [Coolify Cloud Setup](#coolify-cloud-setup)
6. [Database Setup](#database-setup)
7. [Application Deployment](#application-deployment)
8. [Internationalization (i18n) Configuration](#internationalization-i18n-configuration)
9. [Environment Variables](#environment-variables)
10. [SSL Configuration](#ssl-configuration)
11. [CI/CD Setup](#cicd-setup)
12. [Monitoring & Maintenance](#monitoring--maintenance)
13. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting deployment:

- [ ] Domain registered (teamshots.vip)
- [ ] GitHub repository set up
- [ ] Resend account for emails (free tier: 100/day)
- [ ] SSH key pair generated for server access
- [ ] All features tested locally
- [ ] No console errors in browser
- [ ] Docker build succeeds locally: `docker build -t teamshots .`
- [ ] Prisma migrations are ready
- [ ] Health check endpoint works (`/api/health`)
- [ ] All dependencies installed and locked

---

## Hetzner VPS Setup

### 1. Create Hetzner Cloud Server

**Steps:**

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
  - Allow SSH (22) from anywhere (Coolify Cloud needs access)
  - Allow HTTP (80) from anywhere
  - Allow HTTPS (443) from anywhere
  - Allow port 8000 from anywhere (Coolify Cloud agent communication)

**Checklist:**
- [ ] Hetzner VPS provisioned (CPX21 or higher)
- [ ] Server accessible via SSH with key-based authentication
- [ ] Hetzner Cloud Firewall configured (all 4 ports above)
- [ ] Server IP address noted for next steps

### 2. Initial Server Setup (Optional)

**Basic system update** (optional, but recommended):

```bash
ssh root@[YOUR_SERVER_IP]
apt update && apt upgrade -y
```

**That's it!** 

The Coolify Cloud agent (installed in the next step) will automatically handle:
- ✅ Docker installation
- ✅ Docker Compose setup
- ✅ Required dependencies
- ✅ Network configuration
- ✅ Service management

**Checklist:**
- [ ] Server updated: `apt update && apt upgrade -y` (optional)
- [ ] ✅ No manual Docker installation needed - Coolify handles it!

---

## DNS Configuration

Configure DNS records at your domain registrar. See [DNS_SETUP.md](./DNS_SETUP.md) for detailed instructions.

**Required A Records:**
```
@ (root)     →  [YOUR_SERVER_IP]
www          →  [YOUR_SERVER_IP]
app          →  [YOUR_SERVER_IP]
```

Verify DNS propagation:
```bash
dig www.teamshots.vip +short
dig app.teamshots.vip +short
```

Both should return your server IP address.

**Checklist:**
- [ ] DNS A records configured (root, www, app)
- [ ] DNS propagation verified (`dig www.teamshots.vip`)

---

## Cloudflare Setup (Optional but Recommended)

Cloudflare provides CDN, DDoS protection, caching, and performance optimization for free. It sits between your users and your server.

### Why Use Cloudflare?

- ✅ **Free CDN** - Global content delivery network
- ✅ **DDoS Protection** - Automatic protection against attacks
- ✅ **SSL/TLS** - Additional SSL layer (Universal SSL)
- ✅ **Caching** - Reduce server load and improve speed
- ✅ **Analytics** - Traffic insights and metrics
- ✅ **Firewall** - Block malicious traffic
- ✅ **Always Online** - Shows cached version if server is down

### 1. Create Cloudflare Account

1. Go to [Cloudflare](https://dash.cloudflare.com/sign-up)
2. Sign up for a free account
3. Verify your email address

### 2. Add Your Domain to Cloudflare

1. Click **+ Add a Site** in Cloudflare dashboard
2. Enter your domain: `teamshots.vip`
3. Select **Free Plan** (sufficient for most use cases)
4. Click **Continue**

Cloudflare will scan your existing DNS records automatically.

### 3. Review DNS Records

Cloudflare will import your existing DNS records. Verify these are correct:

**Required A Records:**
```
Type    Name    Content              Proxy Status    TTL
A       @       [YOUR_SERVER_IP]     Proxied         Auto
A       www     [YOUR_SERVER_IP]     Proxied         Auto
A       app     [YOUR_SERVER_IP]     Proxied         Auto
```

**Important Settings:**
- **Proxy Status**: Set to **Proxied** (orange cloud ☁️) - this enables Cloudflare CDN
- **TTL**: Set to **Auto** - Cloudflare manages this automatically

### 4. Change Nameservers at Domain Registrar

Cloudflare will provide you with 2 nameservers like:
```
amber.ns.cloudflare.com
chad.ns.cloudflare.com
```

**Steps:**
1. Go to your domain registrar (where you bought teamshots.vip)
2. Find DNS/Nameserver settings
3. Replace existing nameservers with Cloudflare's nameservers
4. Save changes

**Note**: Nameserver changes can take 24-48 hours to propagate, but usually complete within a few hours.

### 5. SSL/TLS Configuration

Once nameservers are active, configure SSL/TLS:

1. Go to **SSL/TLS** → **Overview** in Cloudflare dashboard
2. Select encryption mode: **Full (strict)** ⭐ RECOMMENDED

**SSL/TLS Modes Explained:**
- ❌ **Off**: No HTTPS (not recommended)
- ❌ **Flexible**: HTTPS between user and Cloudflare, HTTP to server (not secure)
- ✅ **Full**: HTTPS everywhere, but doesn't validate server certificate
- ⭐ **Full (strict)**: HTTPS everywhere with valid certificate (BEST - use this!)

**Why Full (strict)?**
- Most secure option
- Works perfectly with Coolify's Let's Encrypt certificates
- End-to-end encryption

3. Go to **SSL/TLS** → **Edge Certificates**
4. Enable these settings:
   - ✅ **Always Use HTTPS** - Force HTTPS redirects
   - ✅ **Automatic HTTPS Rewrites** - Fix mixed content
   - ✅ **Minimum TLS Version**: TLS 1.2 (or TLS 1.3 for better security)
   - ✅ **Opportunistic Encryption** - Better performance
   - ✅ **TLS 1.3** - Enable for better security and speed

### 6. Caching Configuration

Configure caching to improve performance:

1. Go to **Caching** → **Configuration**
2. **Caching Level**: Standard
3. **Browser Cache TTL**: 4 hours (or higher for production)

**Recommended Cache Rules:**

Go to **Caching** → **Cache Rules** → **Create Rule**:

**Rule 1: Cache Static Assets**
- **Rule name**: Cache Static Assets
- **When incoming requests match**: Custom filter expression
- **Field**: URI Path
- **Operator**: contains
- **Value**: `/static/` OR `/images/` OR `/css/` OR `/js/`
- **Then**: Cache eligibility → Eligible
- **Edge TTL**: 1 month

**Rule 2: Don't Cache API Routes**
- **Rule name**: Bypass API Cache
- **When incoming requests match**: Custom filter expression
- **Field**: URI Path
- **Operator**: starts with
- **Value**: `/api/`
- **Then**: Cache eligibility → Bypass cache

### 7. Speed Optimization

Go to **Speed** → **Optimization**:

Enable these settings:
- ✅ **Auto Minify**: Check JavaScript, CSS, HTML
- ✅ **Brotli** - Better compression than gzip
- ✅ **Rocket Loader** - Defer JavaScript loading (test this, may break some apps)
- ✅ **Mirage** - Image optimization for mobile

**Image Optimization (Polish):**
- Go to **Speed** → **Optimization** → **Polish**
- Select **Lossless** (or Lossy for smaller files)
- Enable **WebP** conversion

### 8. Security Settings

Go to **Security** → **Settings**:

**Security Level**: Auromatically on high protection
- I'm Under Attack!: Use only during active DDoS attacks

**Bot Fight Mode**: ✅ Enable
- Free protection against automated bots

**Challenge Passage**: 30 minutes
- How long a passed challenge is valid

**Browser Integrity Check**: ✅ Enable
- Blocks known malicious browsers

### 9. Firewall Rules (Optional)

Go to **Security** → **WAF** → **Firewall Rules**:

**Example Rule: Block Access to Admin Paths**
```
Rule name: Block Admin Paths
When incoming requests match:
  (http.request.uri.path contains "/admin" and not ip.src in {YOUR_IP_ADDRESS})
Then: Block
```

**Example Rule: Rate Limiting on API**
```
Rule name: Rate Limit API
When incoming requests match:
  (http.request.uri.path starts with "/api/")
Then: Challenge (after X requests per Y seconds)
```

### 10. Page Rules (Optional but Useful)

Go to **Rules** → **Page Rules**:

**Example Rules:**

**Rule 1: Force HTTPS on All Pages**
- URL: `http://*teamshots.vip/*`
- Setting: Always Use HTTPS

**Rule 2: Cache Static Content**
- URL: `*teamshots.vip/static/*`
- Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month

**Rule 3: Bypass Cache for API**
- URL: `*teamshots.vip/api/*`
- Setting: Cache Level: Bypass

### 11. Network Settings

Go to **Network**:

- ✅ **HTTP/2**: Enable (enabled by default)
- ✅ **HTTP/3 (with QUIC)**: Enable (faster, experimental)
- ✅ **0-RTT Connection Resumption**: Enable (faster reconnects)
- ✅ **IPv6 Compatibility**: Enable
- ✅ **WebSockets**: Enable (required for real-time features)
- ⚠️ **gRPC**: Enable only if you use gRPC

### 12. Analytics & Monitoring

Go to **Analytics & Logs** → **Web Analytics**:

Cloudflare provides free analytics:
- Traffic volume
- Bandwidth usage
- Threats blocked
- Response codes
- Top countries/IPs
- Cache performance

**No setup needed** - analytics are automatic!

### 13. Custom Error Pages (Optional)

Go to **Custom Pages**:

Customize error pages for:
- 500 Internal Server Error
- 502 Bad Gateway
- 503 Service Unavailable
- 504 Gateway Timeout
- 1000 Cloudflare Error

Upload custom HTML for better branding.

### 14. Email Routing (Required for Your App)

Your app uses the following email addresses (configured in `src/config/brand.ts`):

**Emails Used in TeamShots:**
- `hello@teamshots.vip` - FROM address for waitlist welcome emails
- `support@teamshots.vip` - REPLY-TO address for customer support
- `privacy@teamshots.vip` - Privacy-related inquiries
- `legal@teamshots.vip` - Legal-related inquiries

**Setup Email Forwarding:**

1. Go to **Email** → **Email Routing** in Cloudflare
2. Click **Get Started** / **Enable Email Routing**
3. **Add Destination Address** (your personal email where you want to receive emails):
   - Enter your personal email (e.g., `yourname@gmail.com`)
   - Verify it (Cloudflare sends verification email)
   
4. **Create Routing Rules** for each email address:

   **Rule 1: Hello (Waitlist Emails)**
   - Match incoming emails: `hello@teamshots.vip`
   - Action: Forward to → `yourname@gmail.com`
   - Priority: 1

   **Rule 2: Support (Customer Support)**
   - Match incoming emails: `support@teamshots.vip`
   - Action: Forward to → `yourname@gmail.com`
   - Priority: 2

   **Rule 3: Privacy**
   - Match incoming emails: `privacy@teamshots.vip`
   - Action: Forward to → `yourname@gmail.com`
   - Priority: 3

   **Rule 4: Legal**
   - Match incoming emails: `legal@teamshots.vip`
   - Action: Forward to → `yourname@gmail.com`
   - Priority: 4

   **Optional: Catch-All Rule**
   - Match incoming emails: `*@teamshots.vip` (catch everything else)
   - Action: Forward to → `yourname@gmail.com`
   - Priority: 5

5. Cloudflare will **automatically add required DNS records**:
   - MX records (for receiving emails)
   - TXT records (SPF, DKIM for email authentication)

**Important Notes:**

- **Sending Emails**: Your app sends emails through **Resend** (not Cloudflare)
- **Receiving Emails**: Cloudflare forwards replies to your personal email
- **Reply Handling**: When users reply to waitlist emails, they go to `support@teamshots.vip` which forwards to you
- **Multiple Recipients**: You can forward the same address to multiple emails (e.g., support goes to you AND your team)

**Example Use Cases:**
- User signs up → Receives email from `hello@teamshots.vip` (sent via Resend)
- User replies → Email goes to `support@teamshots.vip` → Forwarded to your Gmail
- Privacy inquiry → Someone emails `privacy@teamshots.vip` → Forwarded to you

**Pro Tip**: Consider using different personal emails for different purposes:
- `hello@` and `support@` → Your main support email
- `privacy@` → Compliance team email
- `legal@` → Legal team or attorney email

### Verification After Setup

Once Cloudflare is active:

```bash
# Check if Cloudflare is active (should see Cloudflare IPs, not your server IP)
dig www.teamshots.vip +short

# Check SSL certificate (should show Cloudflare)
curl -vI https://www.teamshots.vip 2>&1 | grep -i "issuer"

# Check response headers (should see cf-ray and cf-cache-status)
curl -I https://www.teamshots.vip
```

**Expected Headers:**
```
cf-ray: xxxxx-XXX
cf-cache-status: HIT or MISS
server: cloudflare
```

### Important Notes

**Coolify + Cloudflare Compatibility:**
- ✅ Coolify's Let's Encrypt SSL works perfectly with Cloudflare Full (strict) mode
- ✅ Cloudflare sees Coolify's valid SSL certificate
- ✅ Both provide SSL - double protection!

**Initial Setup Time:**
- Nameserver propagation: 2-48 hours (usually <2 hours)
- SSL provisioning: 5-15 minutes after nameservers are active
- Cloudflare becomes active immediately after nameserver change

**Cache Purging:**
- Go to **Caching** → **Configuration** → **Purge Cache**
- Options: Purge Everything, Purge by URL, Purge by Tag
- Use after deploying new code if cached pages don't update

**Development Mode:**
- Go to **Caching** → **Configuration**
- Enable **Development Mode** temporarily (3 hours)
- Bypasses cache while developing
- Automatically disables after 3 hours

### Checklist:

- [ ] Cloudflare account created
- [ ] Domain added to Cloudflare
- [ ] DNS records verified (A records for @, www, app)
- [ ] Proxy status set to "Proxied" (orange cloud)
- [ ] Nameservers changed at domain registrar
- [ ] Nameserver change propagated (check Cloudflare dashboard)
- [ ] SSL/TLS mode set to **Full (strict)**
- [ ] Always Use HTTPS enabled
- [ ] Minimum TLS 1.2 or 1.3 configured
- [ ] Auto Minify enabled (JS, CSS, HTML)
- [ ] Brotli compression enabled
- [ ] Bot Fight Mode enabled
- [ ] Security level set appropriately
- [ ] Caching rules configured (static assets, API bypass)
- [ ] Page rules created (optional)
- [ ] HTTP/2 and HTTP/3 enabled
- [ ] WebSockets enabled
- [ ] **Email Routing configured for all 4 addresses** (hello, support, privacy, legal)
- [ ] Email destination verified (check your personal email)
- [ ] Test email sent to each address and received
- [ ] Cloudflare headers visible in responses (cf-ray)
- [ ] SSL certificate shows Cloudflare in chain
- [ ] Cache working (check cf-cache-status header)

---

## Coolify Cloud Setup

### 1. Create Coolify Cloud Account

1. Go to [Coolify Cloud](https://app.coolify.io)
2. Sign up or log in to your account
3. You'll manage all deployments from the Coolify Cloud dashboard

**Benefits of Coolify Cloud:**
- No need to install Coolify on your server
- Managed updates and maintenance
- Dashboard accessible from anywhere
- Built-in monitoring and alerts

### 2. Connect Your Hetzner Server to Coolify Cloud

1. In Coolify Cloud dashboard, go to **Servers** → **+ Add Server**
2. Fill in server details:
   - **Name**: TeamShots Production
   - **IP Address**: [Your Hetzner server IP]
   - **User**: root
   - **Port**: 22 (SSH)
   - **SSH Key**: Upload or paste your private SSH key

3. **Coolify Cloud will provide an installation command** like:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash -s <YOUR_UNIQUE_TOKEN>
   ```

4. **SSH into your Hetzner server** and run the command:
   ```bash
   ssh root@[YOUR_SERVER_IP]
   # Paste the installation command from Coolify Cloud
   ```

5. **Wait for connection** - Coolify Cloud will automatically detect when the server is ready
6. **Verify** - You should see "Connected" status in the Coolify Cloud dashboard

### 3. Server Requirements

Make sure your Hetzner server firewall allows:
- **Port 22** (SSH) - from anywhere (Coolify Cloud needs access)
- **Port 80** (HTTP) - from anywhere
- **Port 443** (HTTPS) - from anywhere
- **Port 8000** - from anywhere (for Coolify Cloud agent communication)

**Checklist:**
- [ ] Coolify Cloud account created at [app.coolify.io](https://app.coolify.io)
- [ ] Server added in Coolify Cloud dashboard
- [ ] Coolify Cloud agent installation command copied
- [ ] Agent installed on Hetzner server (via SSH)
- [ ] Server status shows "Connected" in Coolify Cloud
- [ ] Email notifications configured (optional)

### 4. Python Dependencies for Background Processing

TeamShots uses Python with rembg for high-quality background removal from selfies.

**Install Python 3.9+ and dependencies:**
```bash
# Install Python 3.9+ (if not already installed)
apt update && apt install python3 python3-pip -y

# Install rembg and dependencies
pip3 install rembg>=2.0.50 Pillow>=9.0.0 numpy>=1.21.0 onnxruntime click filetype watchdog
```

**Verify installation:**
```bash
python3 -c "import rembg; print('rembg installed successfully')"
```

**Checklist:**
- [ ] Python 3.9+ installed
- [ ] rembg library installed
- [ ] All dependencies verified
- [ ] Background removal script tested

---

## Database Setup

### 1. Create PostgreSQL Database in Coolify Cloud

1. In Coolify Cloud dashboard, go to **Databases** → **+ Add Database**
2. Select **PostgreSQL 16**
3. Configure:
   - **Server**: Select your "TeamShots Production" server
   - **Name**: teamshots-db
   - **Database Name**: teamshots
   - **Username**: teamshots_user
   - **Password**: [Generate strong password - save this securely!]
   - **Port**: 5432 (internal Docker network)
   - **Public Port**: Leave unchecked (database should not be publicly accessible)
4. Click **Deploy**
5. Wait for the database to start (status will show "Running")

### 2. Get Database Connection String

Once deployed, Coolify will provide the internal connection string:

```
postgresql://teamshots_user:[PASSWORD]@teamshots-db:5432/teamshots
```

**Note**: This uses Docker networking. The database is only accessible from other containers on the same network.

### 3. Run Prisma Migrations

After the app is deployed, you'll need to run migrations. This can be done via:

**Option A: Coolify Console (Recommended)**
1. Go to your app in Coolify
2. Click **Console**
3. Run: `npx prisma migrate deploy`

**Option B: SSH into server**
```bash
docker exec -it [container-name] npx prisma migrate deploy
```

**Checklist:**
- [ ] PostgreSQL 16 database created via Coolify Cloud
- [ ] Server selected: TeamShots Production
- [ ] Database name: teamshots
- [ ] Username: teamshots_user
- [ ] Strong password generated and saved securely
- [ ] Public port disabled (internal network only)
- [ ] Database status shows "Running"
- [ ] Internal connection string copied (for DATABASE_URL)

---

## Application Deployment

### 1. Create New Application in Coolify Cloud

1. In Coolify Cloud dashboard, go to **Projects** → **+ New Project**
2. Name it "TeamShots Production"
3. Click **+ Add Resource** → **Application**
4. **Source Configuration**:
   - **Source**: GitHub
   - **Connect GitHub**: Authorize Coolify Cloud to access your repositories
   - **Repository**: Select `yourusername/teamshots`
   - **Branch**: main
5. **Build Configuration**:
   - **Server**: Select "TeamShots Production"
   - **Build Pack**: Dockerfile
   - **Dockerfile Path**: `./Dockerfile`
   - **Port**: 3000
6. **Domain Configuration**:
   - Add domain: `www.teamshots.vip`
   - Add domain: `app.teamshots.vip`
   - Both domains will automatically get SSL certificates
7. **Health Check**:
   - **Path**: `/api/health`
   - **Port**: 3000 (same as application port)

### 2. Configure Build Settings

In the application settings within Coolify Cloud:

**Build Configuration:**
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `.`
- **Build Arguments**: (none needed for basic setup)

**Deployment:**
- **Auto Deploy**: Enable (automatically deploys on git push to main branch)
- **Deployment Type**: Rolling (zero-downtime deployments)
- **Restart Policy**: unless-stopped

**Important**: Coolify Cloud handles all Docker builds on your connected server automatically.

### 3. Health Check Endpoint

The health check endpoint already exists at `src/app/api/health/route.ts` - it verifies the app and database connection.

**Checklist:**
- [ ] Project created in Coolify Cloud: "TeamShots Production"
- [ ] GitHub account connected to Coolify Cloud
- [ ] Repository selected: yourusername/teamshots
- [ ] Application created with:
  - [ ] Server: TeamShots Production
  - [ ] Branch: main
  - [ ] Build Pack: Dockerfile
  - [ ] Dockerfile path: `./Dockerfile`
  - [ ] Port: 3000
- [ ] Domains configured: www.teamshots.vip, app.teamshots.vip
- [ ] Auto-deploy enabled
- [ ] Health check path: `/api/health`, Port: 3000

---

## Internationalization (i18n) Configuration

### URL Structure

TeamShots supports both English and Spanish with the following URL patterns:

**English (Default):**
- Marketing: `https://www.teamshots.vip`
- App: `https://app.teamshots.vip` (redirects to `/en/app-routes/`)

**Spanish:**
- Marketing: `https://www.teamshots.vip/es`
- App: `https://app.teamshots.vip/es` (redirects to `/es/app-routes/`)

### Locale Detection

The app automatically detects user language preference:
1. **URL-based**: `/es/app-routes/dashboard` → Spanish
2. **Session-based**: User's saved locale preference
3. **Browser-based**: Accept-Language header fallback

### App Routes Internationalization

The `app.teamshots.vip` subdomain routes to the internationalized app-routes:

- `app.teamshots.vip/dashboard` → `/en/app-routes/dashboard`
- `app.teamshots.vip/es/dashboard` → `/es/app-routes/dashboard`
- `app.teamshots.vip/team` → `/en/app-routes/team`
- `app.teamshots.vip/es/team` → `/es/app-routes/team`

### Environment Variables for i18n

No additional environment variables needed - the i18n configuration is built into the Next.js application.

### Testing Internationalization

After deployment, test both languages:

```bash
# Test English
curl -I https://app.teamshots.vip/dashboard

# Test Spanish  
curl -I https://app.teamshots.vip/es/dashboard

# Test locale detection
curl -H "Accept-Language: es" https://app.teamshots.vip/dashboard
```

### Troubleshooting i18n Issues

**Common Issues:**
1. **Wrong locale in URL**: Check middleware configuration
2. **Missing translations**: Verify `messages/en.json` and `messages/es.json`
3. **Navigation not locale-aware**: Ensure using `@/i18n/routing` hooks
4. **Subdomain not working**: Check DNS and Coolify domain configuration

---

## Environment Variables

### 1. Configure in Coolify Cloud

In your application settings → **Environment Variables** tab, add:

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

For sensitive data in Coolify Cloud:
1. Click the "👁️" (eye) icon next to each sensitive variable to mark it as "Secret"
2. Secret variables are encrypted and hidden in the UI
3. Never commit sensitive values to git
4. Use Coolify Cloud's built-in secrets manager for team access control

### 3. Environment-Specific Values

Coolify Cloud supports multiple environments. You can create separate applications for:
- **Production**: www.teamshots.vip (main application)
- **Staging**: staging.teamshots.vip (optional, for testing)
- **Development**: Local only (use local environment)

Each application can have its own environment variables and database.

**Checklist:**
- [ ] `DATABASE_URL` - Internal PostgreSQL connection string
- [ ] `RESEND_API_KEY` - From Resend dashboard
- [ ] `NEXT_PUBLIC_BASE_URL` - https://www.teamshots.vip
- [ ] `NEXTAUTH_URL` - https://www.teamshots.vip
- [ ] `NEXTAUTH_SECRET` - Generated: `openssl rand -base64 32`
- [ ] `NODE_ENV` - production
- [ ] All sensitive variables marked as "Secret" (eye icon)

---

## SSL Configuration

### Automatic SSL (Enabled by Default)

Coolify Cloud automatically provisions SSL certificates via Let's Encrypt:

1. **Ensure DNS is pointing to your server** (verify with `dig www.teamshots.vip`)
2. **SSL is automatically enabled** when you add domains to your application
3. Coolify Cloud will:
   - Request certificates from Let's Encrypt automatically
   - Auto-renew certificates before expiration (30 days before)
   - Force HTTPS redirects for all traffic
   - Monitor certificate health

**No manual configuration needed!**

### Custom SSL (Advanced)

If you have custom certificates (rarely needed):

1. Go to application settings → **Domains** → Select domain
2. Click **SSL Settings**
3. Upload:
   - Certificate file (.crt)
   - Private key file (.key)
   - Chain file (if applicable)

**Note**: Let's Encrypt automatic SSL is recommended for most use cases.

### Verify SSL

```bash
# Check certificate
curl -vI https://www.teamshots.vip

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/
```

**Checklist:**
- [ ] SSL automatically enabled (default in Coolify Cloud)
- [ ] DNS records verified pointing to server
- [ ] Let's Encrypt certificates provisioned automatically
- [ ] HTTPS redirect enabled automatically

---

## CI/CD Setup

### Automatic Deployment (GitHub Integration)

Coolify Cloud automatically deploys on git push when configured:

1. **Enable Auto Deploy** in application settings (should be ON by default)
2. **GitHub Webhook** is automatically created by Coolify Cloud
3. **Verify webhook**: Go to your GitHub repo → Settings → Webhooks
   - You should see a webhook pointing to Coolify Cloud
4. On push to `main` branch:
   - GitHub triggers webhook to Coolify Cloud
   - Coolify Cloud pulls latest code on your server
   - Builds Docker image on your server
   - Runs health checks (`/api/health`)
   - Performs rolling deployment (zero downtime)
   - Notifies you of deployment status

### Manual Deployment

Via Coolify Cloud dashboard:
1. Go to your application in Coolify Cloud
2. Click **Deploy** button in the top right
3. Optionally select specific commit/tag to deploy
4. Monitor deployment progress in real-time logs

**No CLI installation needed** - everything is managed through the Coolify Cloud web interface.

### Deployment Pipeline

```
git push origin main
    ↓
GitHub Webhook triggered
    ↓
Coolify Cloud receives hook
    ↓
Coolify Cloud triggers build on your server
    ↓
Pull latest code from GitHub
    ↓
Build Docker image on server
    ↓
Run Prisma migrations (if configured)
    ↓
Health check (/api/health)
    ↓
Deploy with rolling update (zero downtime)
    ↓
Notification sent (email/Discord/Slack)
    ↓
Success ✅
```

### Rollback

If deployment fails or you need to rollback:

**Via Coolify Cloud Dashboard:**
1. Go to your application → **Deployments** tab
2. View deployment history with status indicators
3. Find the last successful deployment
4. Click **Redeploy** on that deployment
5. Coolify Cloud will rebuild and deploy that specific commit

**Rollback is instantaneous** - the previous Docker image is still available on the server.

**Checklist:**
- [ ] GitHub webhook active (verify in repo settings)
- [ ] Auto-deploy enabled in Coolify Cloud
- [ ] Auto-deployment tested (push to main branch)
- [ ] Deployment notifications working
- [ ] Rollback procedure tested

---

## Monitoring & Maintenance

### Coolify Cloud Built-in Monitoring

Coolify Cloud provides comprehensive monitoring:

- **Real-time Logs**: 
  - Application logs (stdout/stderr)
  - Build logs
  - Deployment logs
  - Searchable and filterable
  
- **Resource Metrics**:
  - CPU usage per container
  - RAM usage and limits
  - Network traffic (in/out)
  - Disk usage
  
- **Health Monitoring**:
  - Application uptime tracking
  - Health check status (`/api/health`)
  - Automatic container restart on failure
  
- **Alerts & Notifications**:
  - Email notifications
  - Discord webhooks
  - Slack integration
  - Deployment success/failure alerts
  - Container crash alerts

### Database Backups

**Automated Backups in Coolify Cloud:**
1. Go to **Databases** → Select `teamshots-db`
2. Click **Backups** tab
3. Enable **Automated Backups**
4. Configure:
   - **Frequency**: Daily at 3:00 AM UTC (recommended)
   - **Retention**: 7-30 days (based on your plan)
   - **Storage**: Coolify Cloud storage (included) or S3-compatible storage
5. Test restoration process periodically

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

- **Coolify Cloud Docs**: https://coolify.io/docs
- **Coolify Cloud Support**: support@coolify.io (for paid plans)
- **Coolify Discord**: https://coollabs.io/discord
- **Hetzner Support**: https://docs.hetzner.com/
- **TeamShots Issues**: Open GitHub issue in your repository

---

## Security Best Practices

### Server Security

- [ ] Keep system updated: `apt update && apt upgrade`
- [ ] Configure Hetzner Cloud Firewall (recommended over UFW)
- [ ] Use SSH keys only (disable password authentication)
- [ ] Restrict SSH access to known IP addresses (optional)
- [ ] Let Coolify Cloud manage Docker security
- [ ] Enable fail2ban for additional brute force protection (optional)
- [ ] Regular security audits and updates

### Application Security

- [ ] All environment variables stored in Coolify Cloud (never in code)
- [ ] Sensitive variables marked as "Secret" (eye icon)
- [ ] HTTPS only (automatic force redirect by Coolify)
- [ ] Security headers configured in Next.js
- [ ] Regular dependency updates (`npm audit`, Dependabot)
- [ ] Database backups enabled in Coolify Cloud
- [ ] Database not publicly accessible (internal network only)

### Monitoring

- [ ] Enable Coolify Cloud email alerts (deployment, errors)
- [ ] Set up external uptime monitoring (UptimeRobot, Pingdom) - optional
- [ ] Configure error tracking (Sentry) - optional but recommended
- [ ] Coolify Cloud automatically monitors SSL expiration
- [ ] Track performance metrics (Coolify Cloud built-in)
- [ ] Set up Discord/Slack notifications in Coolify Cloud

---

## Cost Estimate

**Monthly Costs (USD):**
- Hetzner VPS (CPX21): ~$9
- Domain (teamshots.vip): ~$12/year = $1/month
- Cloudflare: Free (CDN, DDoS protection, SSL, caching) → $0
- Resend Email: Free tier (100/day) → $0
- Coolify Cloud: Free tier (1 server) or $5/month (Pro plan)
- **Total**: ~$10-15/month

**As you scale:**
- Upgrade VPS as needed (CPX31: ~$14/month, CPX41: ~$27/month)
- Cloudflare Pro: $20/month (more page rules, better WAF, image optimization)
- Resend paid tier if >100 emails/day ($10-20/month)
- Database backups to S3 (~$1-5/month)
- Cloudflare Images: $5/month for 100k images (if needed)

---

## Deployment Verification

After deploying, verify everything is working:

**Initial Deployment:**
- [ ] Trigger manual deployment in Coolify Cloud (Deploy button)
- [ ] Monitor build logs in real-time
- [ ] Build completes successfully (no errors)
- [ ] Docker image created successfully
- [ ] Container starts without errors
- [ ] Health check passes (`/api/health` returns 200)

**Database Migrations:**
- [ ] Migrations applied successfully via Coolify Console
- [ ] Database schema verified correct
- [ ] Connection test successful

**Verification:**
- [ ] App accessible at https://www.teamshots.vip
- [ ] App accessible at https://app.teamshots.vip
- [ ] SSL certificate is valid (green padlock)
- [ ] Health check endpoint works
- [ ] Language switching works (EN ↔ ES)
- [ ] Waitlist signup works
- [ ] Email confirmation received (test with your email)

**Post-Deployment:**
- [ ] Coolify Cloud monitoring enabled (automatic)
- [ ] Email alerts configured
- [ ] Database backups configured (daily at 3 AM UTC)
- [ ] Backup retention set (7-30 days)
- [ ] External uptime monitoring setup (optional)
- [ ] Error tracking setup (Sentry - optional)
- [ ] Discord/Slack notifications (optional)

**Security:**
- [ ] All sensitive environment variables marked as "Secret"
- [ ] SSH key authentication only (no passwords)
- [ ] Hetzner Cloud Firewall rules active
- [ ] Coolify Cloud account secured (2FA recommended)
- [ ] Database not publicly accessible

**Go Live:**
- [ ] Test from different devices
- [ ] Test from different locations
- [ ] No console errors
- [ ] No broken links
- [ ] Share live URL with team!

---

## Quick Command Reference

### Via Coolify Cloud Dashboard (Recommended)

- **View Logs**: Application → Logs tab (real-time)
- **Restart App**: Application → Settings → Restart button
- **Run Migrations**: Application → Console → `npx prisma migrate deploy`
- **Database Console**: Database → Console tab
- **Manual Deploy**: Application → Deploy button

### Via SSH (Advanced)

```bash
# SSH to server
ssh root@[YOUR_SERVER_IP]

# View running containers
docker ps

# View application logs (if needed)
docker logs -f [container-name]

# Restart application (use Coolify Cloud instead)
docker restart [container-name]

# Database backup (manual)
docker exec teamshots-db pg_dump -U teamshots_user teamshots > backup.sql

# Enter database console
docker exec -it teamshots-db psql -U teamshots_user teamshots

# Run migrations (use Coolify Cloud Console instead)
docker exec -it [app-container] npx prisma migrate deploy

# Check disk space
df -h

# Update system
apt update && apt upgrade -y
```

**Note**: Most operations can be done through the Coolify Cloud dashboard, which is easier and safer than direct SSH access.

---

## Why Coolify Cloud?

**Coolify Cloud Benefits:**
- ✅ **No server maintenance** - No need to install or update Coolify on your server
- ✅ **Managed service** - Updates, security patches, and improvements handled automatically
- ✅ **Accessible anywhere** - Manage deployments from any device with internet access
- ✅ **Built-in monitoring** - Comprehensive metrics, logs, and alerts out of the box
- ✅ **Zero downtime** - Automatic rolling deployments with health checks
- ✅ **Easy rollbacks** - One-click rollback to any previous deployment

