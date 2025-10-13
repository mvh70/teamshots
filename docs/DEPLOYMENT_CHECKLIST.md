# Deployment Checklist - TeamShots

Use this checklist to ensure a smooth deployment to production.

## Pre-Deployment

### 1. Code & Configuration
- [ ] All features tested locally
- [ ] No console errors in browser
- [ ] All environment variables documented
- [ ] Database schema is up to date
- [ ] Prisma migrations are ready
- [ ] Health check endpoint works (`/api/health`)
- [ ] Docker build succeeds locally: `docker build -t teamshots .`
- [ ] All dependencies are installed and locked

### 2. DNS & Domain
- [ ] Domain registered (teamshots.vip)
- [ ] DNS A records configured (see [DNS_SETUP.md](./DNS_SETUP.md)):
  - [ ] Root domain (@) → 94.130.225.35
  - [ ] www subdomain → 94.130.225.35
  - [ ] app subdomain → 94.130.225.35
- [ ] DNS propagation verified (`dig www.teamshots.vip`)

### 3. Server Setup
- [ ] Hetzner VPS provisioned
- [ ] Server accessible via SSH
- [ ] Docker installed on server
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] Server updated: `apt update && apt upgrade -y`

## Coolify Setup

### 4. Coolify Installation
- [ ] Coolify installed on server
- [ ] Coolify dashboard accessible
- [ ] Admin password set (saved securely)
- [ ] Email notifications configured (optional)

### 5. Database Setup in Coolify
- [ ] PostgreSQL 16 database created
- [ ] Database credentials saved securely
- [ ] Database connection string obtained
- [ ] Database is healthy in Coolify dashboard

### 6. Application Configuration
- [ ] GitHub repository connected to Coolify
- [ ] Application created in Coolify
- [ ] Branch configured (main)
- [ ] Dockerfile path set (`./Dockerfile`)
- [ ] Port set to 3000
- [ ] Domains added:
  - [ ] www.teamshots.vip
  - [ ] app.teamshots.vip
- [ ] Auto-deploy enabled
- [ ] Health check path set (`/api/health`)

### 7. Environment Variables
Set in Coolify application settings:

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `RESEND_API_KEY` - From Resend dashboard
- [ ] `NEXT_PUBLIC_BASE_URL` - https://www.teamshots.vip
- [ ] `NEXTAUTH_URL` - https://www.teamshots.vip
- [ ] `NEXTAUTH_SECRET` - Generated: `openssl rand -base64 32`
- [ ] `NODE_ENV` - production

All secrets marked as "Secret" in Coolify ✓

### 8. SSL Configuration
- [ ] Automatic SSL enabled in Coolify
- [ ] Let's Encrypt configured
- [ ] HTTPS redirect enabled

## Initial Deployment

### 9. First Deploy
- [ ] Trigger manual deployment in Coolify
- [ ] Build completes successfully
- [ ] Container starts without errors
- [ ] Health check passes

### 10. Database Migrations
Run Prisma migrations:

```bash
# Option 1: Via Coolify console
npx prisma migrate deploy

# Option 2: Via SSH
docker exec -it [container-name] npx prisma migrate deploy
```

- [ ] Migrations applied successfully
- [ ] Database schema is correct

### 11. Verification
- [ ] App accessible at https://www.teamshots.vip
- [ ] App accessible at https://app.teamshots.vip
- [ ] SSL certificate is valid (green padlock)
- [ ] Health check endpoint works: https://www.teamshots.vip/api/health
- [ ] Language switching works (EN ↔ ES)
- [ ] Waitlist signup works
- [ ] Email confirmation received (test with your email)

## Post-Deployment

### 12. Monitoring Setup
- [ ] Coolify monitoring enabled
- [ ] Database backups configured (daily)
- [ ] Uptime monitoring setup (UptimeRobot/Pingdom)
- [ ] Error tracking setup (Sentry - optional)
- [ ] Log retention configured

### 13. CI/CD
- [ ] GitHub webhook active in Coolify
- [ ] Auto-deployment tested (push to main)
- [ ] Deployment notifications configured (optional)
- [ ] Rollback procedure tested

### 14. Email Service
- [ ] Resend account active
- [ ] Domain verified in Resend
- [ ] DNS records for email configured:
  - [ ] SPF record
  - [ ] DKIM records
  - [ ] DMARC record (optional)
- [ ] Test email sent and received
- [ ] Unsubscribe link works

### 15. Security
- [ ] All environment variables are secrets (not visible)
- [ ] SSH key authentication only (no passwords)
- [ ] Firewall rules active
- [ ] Coolify dashboard secured
- [ ] HTTPS only (HTTP redirects to HTTPS)
- [ ] Security headers configured

### 16. Documentation
- [ ] Team has access to server credentials
- [ ] Deployment process documented
- [ ] Emergency contacts listed
- [ ] Rollback procedure documented
- [ ] Monitoring dashboards shared

### 17. Performance
- [ ] Page load time < 2 seconds
- [ ] Lighthouse score > 90
- [ ] Images optimized
- [ ] CDN configured (optional, for later)

### 18. Legal & Compliance
- [ ] Privacy policy accessible
- [ ] Terms of service accessible
- [ ] GDPR compliance (if targeting EU)
- [ ] Cookie consent (if needed)

## Go-Live

### 19. Final Checks
- [ ] All above items completed ✓
- [ ] Test from different devices
- [ ] Test from different locations (VPN)
- [ ] Test all user flows:
  - [ ] Landing page loads
  - [ ] Pricing page loads
  - [ ] Language switching
  - [ ] Waitlist signup
  - [ ] Email confirmation
- [ ] No console errors
- [ ] No broken links

### 20. Launch
- [ ] Announce on social media
- [ ] Update GitHub README with live URL
- [ ] Share with beta testers
- [ ] Monitor error logs closely (first 24 hours)
- [ ] Be ready for hot fixes

## Post-Launch (First Week)

### 21. Monitoring
- [ ] Check server resources (CPU, RAM, disk)
- [ ] Review error logs daily
- [ ] Monitor email delivery rates
- [ ] Track waitlist signups
- [ ] Check SSL certificate auto-renewal

### 22. Optimization
- [ ] Review performance metrics
- [ ] Optimize database queries if needed
- [ ] Add caching if needed
- [ ] Scale server if needed

## Emergency Contacts

**Server Issues:**
- Hetzner Support: https://docs.hetzner.com/

**Coolify Issues:**
- Discord: https://coollabs.io/discord
- Docs: https://coolify.io/docs

**Application Issues:**
- Check logs in Coolify
- Review `/api/health` endpoint
- SSH to server for manual debugging

**DNS Issues:**
- Domain registrar support
- DNS propagation: https://dnschecker.org/

## Rollback Procedure

If something goes wrong:

1. **Via Coolify Dashboard:**
   - Go to Deployments history
   - Select last working deployment
   - Click "Redeploy"

2. **Via Server:**
   ```bash
   ssh root@94.130.225.35
   docker ps  # Get container ID
   docker stop [container-id]
   docker start [previous-container-id]
   ```

3. **Database Rollback:**
   ```bash
   # Restore from backup
   docker exec -i teamshots-db psql -U teamshots_user teamshots < backup.sql
   ```

---

**Status**: Ready for deployment! 🚀

Once all items are checked, you're ready to go live with TeamShots!

