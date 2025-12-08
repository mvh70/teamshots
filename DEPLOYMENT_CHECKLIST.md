# Outfit Transfer Feature - Deployment Checklist

## Pre-Deployment Tasks

### 1. Code Review
- [ ] Review all 27 files (15 new, 12 modified)
- [ ] Verify TypeScript compilation: `npm run type-check`
- [ ] Verify linting: `npm run lint`
- [ ] Test build: `npm run build`
- [ ] Review security implementations

### 2. Database Preparation
- [ ] Backup production database
- [ ] Review migration file: `prisma/migrations/.../migration.sql`
- [ ] Test migration on staging database:
  ```bash
  npx prisma migrate deploy
  ```
- [ ] Verify new columns exist:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'Generation'
  AND column_name IN ('generationType', 'outfitAssetId', 'outfitReferenceKey');
  ```

### 3. Environment Variables
- [ ] Set up Google Cloud credentials
  ```bash
  GOOGLE_CLOUD_PROJECT_ID=teamshots
  GOOGLE_CLOUD_LOCATION=us-central1
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
  ```
- [ ] Verify Gemini API access:
  ```bash
  gcloud auth application-default login
  gcloud projects list
  ```
- [ ] Configure OpenRouter (preferred primary Gemini provider)
  ```bash
  OPENROUTER_API_KEY=your_openrouter_key
  GEMINI_PRIMARY_PROVIDER=openrouter
  # Optional: override default model routed via OpenRouter
  OPENROUTER_GEMINI_IMAGE_MODEL=google/gemini-2.5-flash-image-preview
  ```
- [ ] Set feature flag to disabled initially:
  ```bash
  NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER=false
  ```
- [ ] Verify S3 credentials (already configured)
- [ ] Verify Redis connection (already configured)

### 4. Dependencies Check
- [ ] Verify all npm packages installed: `npm install`
- [ ] Check for security vulnerabilities: `npm audit`
- [ ] Verify sharp is installed (for image processing)
- [ ] Verify @google-cloud/vertexai is installed

---

## Deployment Steps

### Stage 1: Deploy with Feature Disabled (Day 1)

#### Step 1: Deploy Code
```bash
# 1. Merge feature branch to main
git checkout main
git pull origin main

# 2. Build production bundle
npm run build

# 3. Run database migration
npx prisma migrate deploy

# 4. Deploy to production (your deployment method)
# Example with PM2:
pm2 restart teamshots
pm2 logs teamshots --lines 100
```

#### Step 2: Verify Core Functionality
- [ ] Application starts successfully
- [ ] No errors in logs
- [ ] Existing features work (headshot generation)
- [ ] outfit1 package NOT visible (feature disabled)
- [ ] `/api/outfit/upload` returns 404 or hidden

#### Step 3: Monitor for 24 Hours
- [ ] Check error rates in logs
- [ ] Verify no regressions in existing features
- [ ] Monitor database performance
- [ ] Check memory usage

### Stage 2: Internal Testing (Days 2-3)

#### Step 1: Enable for Admin Only
```bash
# Option A: Use feature flag for everyone
NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER=true

# Option B: Add admin-only logic (code change needed)
# In src/domain/style/packages/index.ts:
# if (isFeatureEnabled('outfitTransfer') && userIsAdmin) { ... }
```

#### Step 2: Admin Testing
- [ ] Upload outfit image (PNG)
- [ ] Upload outfit image (JPEG)
- [ ] Verify color analysis works
- [ ] Check color swatches display
- [ ] Verify outfit description shown
- [ ] Generate headshot with outfit
- [ ] Verify outfit reference in logs:
  ```bash
  grep "Loaded outfit reference" logs/*.log
  ```
- [ ] Check generated image matches outfit

#### Step 3: Test Edge Cases
- [ ] Upload 10MB file (should succeed)
- [ ] Upload 11MB file (should fail)
- [ ] Upload invalid file (should fail)
- [ ] Upload same outfit twice (should reuse)
- [ ] Upload 6 times rapidly (should rate limit)
- [ ] Analyze non-clothing image (should reject)

#### Step 4: Verify Cost Tracking
```sql
-- Check outfit_color_analysis costs
SELECT * FROM "GenerationCost"
WHERE reason = 'outfit_color_analysis'
ORDER BY createdAt DESC
LIMIT 10;

-- Check generation costs
SELECT * FROM "Generation"
WHERE generationType = 'outfit_transfer'
LIMIT 10;
```

### Stage 3: Beta Rollout (Days 4-10)

#### Step 1: Enable for 10% of Users
```bash
# Option A: Enable globally
NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER=true

# Option B: Add percentage rollout logic (code change needed)
# In src/config/feature-flags.ts:
# enabled: Math.random() < 0.1 && process.env.NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER === 'true'
```

#### Step 2: Monitor Beta Usage
- [ ] Track upload success rate (target: >95%)
  ```sql
  -- Telemetry query (if using telemetry table)
  SELECT
    SUM(CASE WHEN metric = 'outfit.upload.success' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN metric = 'outfit.upload.error' THEN 1 ELSE 0 END) as errors
  FROM telemetry
  WHERE timestamp > NOW() - INTERVAL '7 days';
  ```
- [ ] Track analysis accuracy (user feedback)
- [ ] Monitor error logs:
  ```bash
  grep "outfit.*failed\|outfit.*error" logs/*.log | wc -l
  ```
- [ ] Check rate limit hits:
  ```bash
  grep "outfit.*rate_limited" logs/*.log | wc -l
  ```

#### Step 3: Collect Feedback
- [ ] User satisfaction surveys
- [ ] Bug reports via support
- [ ] Feature requests
- [ ] Performance complaints

#### Step 4: Fix Issues
- [ ] Address any bugs found
- [ ] Optimize performance if needed
- [ ] Adjust rate limits if too restrictive
- [ ] Improve AI prompts if accuracy low

### Stage 4: Full Rollout (Day 11+)

#### Step 1: Enable for All Users
```bash
# Set in production environment
NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER=true
```

#### Step 2: Announce Feature
- [ ] Update documentation
- [ ] Send user email announcement
- [ ] Update landing page
- [ ] Post on social media

#### Step 3: Monitor at Scale
- [ ] Track daily upload volume
- [ ] Monitor AI API costs
- [ ] Check S3 storage usage
- [ ] Monitor database growth

#### Step 4: Optimize
- [ ] Review slow queries
- [ ] Optimize image processing
- [ ] Adjust caching strategy
- [ ] Scale infrastructure if needed

---

## Monitoring Checklist

### Daily Checks (First Week)
- [ ] Upload success rate >95%
- [ ] Analysis success rate >90%
- [ ] No security incidents
- [ ] Cost per generation <$0.06
- [ ] API response times <3s

### Weekly Checks (First Month)
- [ ] Total uploads count
- [ ] Total generations count
- [ ] Average cost per user
- [ ] Storage usage growth
- [ ] User satisfaction scores

### Monthly Checks (Ongoing)
- [ ] Feature adoption rate
- [ ] ROI vs development cost
- [ ] User retention with outfit feature
- [ ] Competitive analysis

---

## Rollback Procedures

### Emergency Rollback (Immediate)
If critical issues arise:

```bash
# 1. Disable feature flag
NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER=false

# 2. Redeploy (no code changes needed)
npm run build
pm2 restart teamshots

# 3. Verify feature is disabled
curl https://your-domain.com/api/outfit/upload
# Should return 404 or "Feature not available"

# 4. Monitor for stabilization
pm2 logs teamshots --lines 100
```

### Partial Rollback (Targeted)
If issues affect specific scenarios:

```bash
# Option 1: Disable only upload endpoint
# Add check in /api/outfit/upload/route.ts:
# if (process.env.DISABLE_OUTFIT_UPLOAD === 'true') return 404

# Option 2: Disable only analysis endpoint
# Add check in /api/outfit/analyze-colors/route.ts:
# if (process.env.DISABLE_OUTFIT_ANALYSIS === 'true') return 404
```

### Database Rollback (Last Resort)
Only if database migration causes issues:

```bash
# 1. Restore database from backup
pg_restore -d teamshots backup.dump

# 2. Roll back migration (if safe)
npx prisma migrate resolve --rolled-back <migration-name>

# 3. Verify data integrity
psql teamshots -c "SELECT COUNT(*) FROM \"Generation\";"
```

---

## Success Metrics

### Week 1 (Internal Testing)
- [ ] ✅ 10+ successful outfit uploads
- [ ] ✅ 10+ successful color analyses
- [ ] ✅ 5+ successful generations
- [ ] ✅ Zero security incidents
- [ ] ✅ Zero data loss incidents

### Week 2 (Beta Testing)
- [ ] ✅ 100+ successful uploads
- [ ] ✅ >95% upload success rate
- [ ] ✅ >90% analysis accuracy
- [ ] ✅ <5% rate limit hit rate
- [ ] ✅ User satisfaction >4/5

### Month 1 (Full Rollout)
- [ ] ✅ 1,000+ successful uploads
- [ ] ✅ outfit1 accounts for >10% of generations
- [ ] ✅ Average cost per generation <$0.06
- [ ] ✅ Zero critical bugs
- [ ] ✅ Positive user feedback

---

## Troubleshooting Guide

### Issue: Feature Not Visible
**Symptoms**: outfit1 package doesn't appear in UI

**Checklist**:
- [ ] Check `NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER=true`
- [ ] Verify build includes environment variable
- [ ] Check browser console for errors
- [ ] Clear browser cache and hard refresh
- [ ] Verify package registered in `CLIENT_PACKAGES`

**Solution**:
```bash
# Rebuild with correct env var
export NEXT_PUBLIC_FEATURE_OUTFIT_TRANSFER=true
npm run build
pm2 restart teamshots
```

### Issue: Upload Fails
**Symptoms**: Error when uploading outfit image

**Checklist**:
- [ ] Check S3 credentials valid
- [ ] Verify bucket permissions
- [ ] Check file size <10MB
- [ ] Verify file type allowed
- [ ] Check rate limit not exceeded
- [ ] Review error logs

**Solution**:
```bash
# Check S3 connection
aws s3 ls s3://your-bucket/ --profile hetzner

# Check logs
grep "Outfit upload failed" logs/*.log | tail -20

# Check rate limit
redis-cli GET "rate-limit:outfit_upload:user-{userId}"
```

### Issue: Color Analysis Fails
**Symptoms**: Gemini returns error

**Checklist**:
- [ ] Check Google Cloud credentials
- [ ] Verify Vertex AI API enabled
- [ ] Check API quota not exceeded
- [ ] Verify image valid (not corrupted)
- [ ] Check network connectivity

**Solution**:
```bash
# Test Gemini API manually
curl -X POST \
  "https://${GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/${GOOGLE_CLOUD_LOCATION}/publishers/google/models/gemini-2.0-flash-exp:generateContent" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -d '{"contents":[{"parts":[{"text":"test"}]}]}'

# Check quotas
gcloud compute quotas list --project=${GOOGLE_CLOUD_PROJECT_ID}
```

### Issue: Generation Doesn't Match Outfit
**Symptoms**: Generated image doesn't reflect uploaded outfit

**Checklist**:
- [ ] Verify outfit reference loaded in logs
- [ ] Check prompt includes outfit description
- [ ] Verify colors extracted correctly
- [ ] Review image quality (too blurry?)
- [ ] Check if outfit actually in image

**Solution**:
```bash
# Enable debug mode in generation
# In /api/generations/create request:
{ "debugMode": true }

# Review full prompt sent to AI
grep "V3 Step 1a.*prompt" logs/*.log | tail -1
```

---

## Post-Deployment Tasks

### Week 1
- [ ] Review all error logs daily
- [ ] Monitor cost metrics
- [ ] Collect user feedback
- [ ] Fix any bugs found
- [ ] Update documentation

### Month 1
- [ ] Analyze usage patterns
- [ ] Optimize performance
- [ ] Plan enhancements
- [ ] Review security logs
- [ ] Update roadmap

### Quarter 1
- [ ] ROI analysis
- [ ] User retention study
- [ ] Feature expansion planning
- [ ] Infrastructure scaling review
- [ ] Competitive assessment

---

## Sign-Off

**Pre-Deployment Review** (Required Approvals):
- [ ] Engineering Lead: ___________
- [ ] Security Review: ___________
- [ ] Product Manager: ___________
- [ ] DevOps Engineer: ___________

**Post-Deployment Sign-Off** (After successful rollout):
- [ ] No critical bugs: ___________
- [ ] Performance acceptable: ___________
- [ ] Users satisfied: ___________
- [ ] Costs within budget: ___________

---

**Deployment Date**: ___________
**Deployed By**: ___________
**Rollout Complete Date**: ___________
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back
