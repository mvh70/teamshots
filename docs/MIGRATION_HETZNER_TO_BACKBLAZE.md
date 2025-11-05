# Migration Guide: Hetzner S3 to Backblaze B2

This guide walks you through migrating your TeamShots application from Hetzner S3 to Backblaze B2 (S3-compatible storage).

## Overview

Backblaze B2 Cloud Storage provides S3-compatible API endpoints, making it a drop-in replacement for Hetzner S3. The migration involves:

1. **Application code changes**: Updated to use generic S3 environment variables
2. **Environment variable updates**: Configure Backblaze credentials
3. **Data migration**: Copy existing files from Hetzner to Backblaze (optional, see below)
4. **Coolify backup configuration**: Update database backup destination

## Part 1: Application S3 Storage Changes

### Step 1: Set Up Backblaze B2 Bucket

1. **Create Backblaze Account**:
   - Go to https://www.backblaze.com/b2/sign-up.html
   - Complete registration

2. **Create B2 Bucket**:
   - Log into Backblaze B2 Dashboard
   - Go to **Buckets** → **Create a Bucket**
   - Choose a bucket name (e.g., `teamshots-photos`)
   - Select **Private** (files are accessed via signed URLs)
   - Choose a region closest to your users:
     - `us-west-000` (US West)
     - `us-west-001` (US West 2)
     - `eu-central-003` (EU Central)
     - `ap-southeast-001` (Asia Pacific)
   - Click **Create a Bucket**

3. **Create Application Key**:
   - Go to **App Keys** → **Add a New Application Key**
   - Key name: `    `
   - Allow access to: **Your Buckets Only**
   - Select your bucket: `teamshots-photos`
   - Capabilities:
     - ✅ **listBuckets** (if needed)
     - ✅ **listFiles**
     - ✅ **readFiles**
     - ✅ **shareFiles**
     - ✅ **writeFiles**
     - ✅ **deleteFiles**
   - Click **Create New Key**
   - **Save these credentials immediately** (you won't see the secret again):
     - `keyID`: Your access key ID
     - `applicationKey`: Your secret access key

4. **Get S3 Endpoint**:
   - Backblaze S3 endpoint format: `https://s3.{region}.backblazeb2.com`
   - Example for `us-west-000`: `https://s3.us-west-000.backblazeb2.com`
   - Example for `eu-central-003`: `https://s3.eu-central-003.backblazeb2.com`

### Step 2: Update Environment Variables

In your Coolify Cloud dashboard or `.env` file, update these environment variables:

**Remove old Hetzner variables:**
```env
# Remove these:
# HETZNER_S3_ENDPOINT=
# HETZNER_S3_ACCESS_KEY=
# HETZNER_S3_SECRET_KEY=
# HETZNER_S3_BUCKET=
# HETZNER_S3_REGION=
```

**Add new S3 variables (works with any S3-compatible provider):**
```env
# S3 Storage Configuration (Backblaze B2)
S3_ENDPOINT=https://s3.us-west-000.backblazeb2.com
S3_ACCESS_KEY_ID=your_backblaze_key_id_here
S3_SECRET_ACCESS_KEY=your_backblaze_application_key_here
S3_BUCKET_NAME=teamshots-photos
S3_REGION=us-west-000
```

**Important Notes:**
- Replace `us-west-000` with your chosen Backblaze region
- The endpoint must include `https://`
- Use your Backblaze application key ID and secret key

### Step 3: Test the Connection

After updating environment variables:

1. **Restart your application** in Coolify Cloud
2. **Test file upload**:
   - Go to your app
   - Try uploading a selfie or background image
   - Check Backblaze B2 dashboard → **Files** → verify files appear
3. **Test file retrieval**:
   - View an uploaded image in your app
   - Verify it loads correctly

### Step 4: Data Migration (Optional)

If you have existing files in Hetzner S3 that you want to migrate:

**Option A: Gradual Migration (Recommended)**
- Keep both Hetzner and Backblaze configured temporarily
- New uploads go to Backblaze
- Old files are accessed from Hetzner until they expire naturally
- No migration needed if your retention policy removes old files

**Option B: Full Migration (If you need all files)**
1. Use a tool like `rclone` or `s3cmd` to copy files:
   ```bash
   # Install rclone
   curl https://rclone.org/install.sh | sudo bash
   
   # Configure Hetzner source
   rclone config
   # Choose "S3" → Enter Hetzner credentials
   
   # Configure Backblaze destination
   rclone config
   # Choose "B2" → Enter Backblaze credentials
   
   # Copy files (example)
   rclone copy hetzner:your-bucket/ backblaze:teamshots-photos/ --progress
   ```

2. **Update database records** (if file paths changed):
   - S3 keys should remain the same (e.g., `selfies/{personId}/{selfieId}.jpg`)
   - Only the bucket/endpoint changes
   - No database changes needed if keys are identical

## Part 2: Coolify Database Backups to Backblaze

### Step 1: Prepare Backblaze for Backups

1. **Create a separate bucket for backups** (recommended):
   - Name: `teamshots-db-backups`
   - Region: Same as your main bucket
   - Access: Private

2. **Create a separate application key for backups**:
   - Go to **App Keys** → **Add a New Application Key**
   - Key name: `teamshots-backups-key`
   - Allow access to: **Your Buckets Only**
   - Select bucket: `teamshots-db-backups`
   - Capabilities:
     - ✅ **listFiles**
     - ✅ **readFiles**
     - ✅ **writeFiles**
     - ✅ **deleteFiles** (for cleanup)
   - Save the credentials

### Step 2: Configure Coolify Backups

1. **Access Coolify Cloud Dashboard**:
   - Go to https://coolify.io
   - Navigate to your project
   - Select your database resource (`teamshots-db`)

2. **Configure Backup Settings**:
   - Go to **Backups** tab
   - Click **Configure Backup**

3. **Set Backup Destination**:
   - **Storage Type**: S3-Compatible
   - **Endpoint**: `https://s3.{region}.backblazeb2.com` (your Backblaze region)
   - **Access Key ID**: Your Backblaze application key ID
   - **Secret Access Key**: Your Backblaze application key secret
   - **Bucket Name**: `teamshots-db-backups`
   - **Region**: Your Backblaze region (e.g., `us-west-000`)
   - **Path**: `/` or leave empty (backups will be stored in root)

4. **Configure Backup Schedule**:
   - **Frequency**: Daily (recommended)
   - **Time**: 3:00 AM UTC (low traffic period)
   - **Retention**: 30 days (or your preference)
   - **Compression**: Enabled (recommended)

5. **Test Backup**:
   - Click **Test Connection** to verify Backblaze credentials
   - Click **Run Backup Now** to create a test backup
   - Verify backup appears in Backblaze B2 dashboard

### Step 3: Verify Backups

1. **Check Backblaze Dashboard**:
   - Go to **Files** → `teamshots-db-backups`
   - Verify backup files appear with timestamps

2. **Test Restore** (Optional but Recommended):
   - In Coolify, go to **Backups** → Select a backup
   - Click **Restore** (test on a staging database first)
   - Verify database restores correctly

## Rollback Plan

If you need to rollback to Hetzner:

1. **Revert environment variables** to Hetzner values
2. **Restart application** in Coolify
3. **Update Coolify backups** back to Hetzner (or previous storage)

## Cost Comparison

**Backblaze B2 Pricing** (as of 2024):
- Storage: $6/TB/month
- Download: $10/TB (first 1GB free per day)
- Upload: Free
- No egress fees to Cloudflare (via B2 Bandwidth Alliance)

**Hetzner Storage Pricing**:
- Storage: ~€2.39/TB/month
- Download: Included (with limits)
- Upload: Free

**Note**: Backblaze offers better global CDN integration and bandwidth pricing for high-traffic applications.

## Troubleshooting

### Issue: Still seeing photos from Hetzner after migration

**Symptoms**: After updating environment variables, you still see photos loading from Hetzner.

**Causes**:
1. Old `HETZNER_S3_*` environment variables are still set (code falls back to them)
2. New `S3_*` variables aren't set correctly
3. Application hasn't been restarted after updating env vars

**Solution**:
1. **Check your current configuration**:
   - Visit `/api/debug/s3-config` in your app (temporary debug endpoint)
   - Or check Coolify → Environment Variables

2. **Verify new variables are set**:
   ```env
   S3_ENDPOINT=https://s3.us-west-000.backblazeb2.com
   S3_ACCESS_KEY_ID=your_key_id
   S3_SECRET_ACCESS_KEY=your_secret_key
   S3_BUCKET_NAME=your-bucket-name
   S3_REGION=us-west-000
   ```

3. **Remove or rename old Hetzner variables**:
   - In Coolify, go to Environment Variables
   - Either delete the `HETZNER_S3_*` variables, OR
   - Rename them (e.g., `OLD_HETZNER_S3_ENDPOINT`) to prevent fallback

4. **Restart your application**:
   - In Coolify, go to your app → Settings → Restart
   - Or use the restart button in the dashboard

5. **Verify the change**:
   - Visit `/api/debug/s3-config` again
   - Should show "Backblaze B2" as provider
   - Should show "✅ Using new S3_* configuration"

6. **Test file upload**:
   - Upload a new photo
   - Check Backblaze B2 dashboard → Files
   - Verify the new file appears in Backblaze (not Hetzner)

**Why you might still see Hetzner photos:**

Even though your configuration is correct, you might still see photos loading because:

1. **Files haven't been migrated yet**: The database has S3 keys (e.g., `selfies/personId/selfieId.jpg`), but the actual files are still in Hetzner, not Backblaze. When your app generates signed URLs pointing to Backblaze, those URLs will fail (404) until you migrate the files.

2. **Browser caching**: Your browser may have cached the old Hetzner URLs. Try:
   - Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
   - Clear browser cache
   - Open in incognito/private mode

3. **Check if files exist in Backblaze**:
   - Use the debug endpoint: `/api/debug/check-file?key=selfies/personId/selfieId.jpg`
   - Or check Backblaze B2 dashboard → Files → verify files are present

**To fix missing files:**

You have two options:

**Option A: Migrate files from Hetzner to Backblaze** (Recommended if you need old photos)
- Use `rclone` or `s3cmd` to copy files from Hetzner to Backblaze
- Keep the same S3 keys (file paths) so database records work
- See "Data Migration (Optional)" section above for detailed steps

**Option B: Let old files expire naturally** (If you don't need old photos)
- New uploads will go to Backblaze automatically
- Old photos will show as broken until your retention policy removes them from the database
- Users can re-upload if needed

### Issue: "Invalid endpoint" error
**Solution**: Ensure endpoint includes `https://` and uses correct format: `https://s3.{region}.backblazeb2.com`

### Issue: "Access Denied" when uploading
**Solution**: Verify application key has `writeFiles` capability and correct bucket access

### Issue: Files not appearing in bucket
**Solution**: Check bucket region matches endpoint region, and verify credentials are correct

### Issue: Signed URLs not working
**Solution**: Ensure `S3_REGION` matches your Backblaze region exactly

### Issue: Coolify backup fails
**Solution**: 
- Verify Backblaze credentials are correct
- Check bucket name matches exactly
- Ensure application key has `writeFiles` permission
- Verify endpoint format is correct

## Next Steps

After migration:

1. ✅ Monitor application logs for S3 errors
2. ✅ Verify file uploads/downloads work correctly
3. ✅ Test backup creation and restore process
4. ✅ Update team documentation with new credentials location
5. ✅ Consider setting up Backblaze B2 lifecycle rules (optional):
   - Auto-delete old backups after retention period
   - Auto-archive to cheaper storage tiers

## Support

- **Backblaze Documentation**: https://www.backblaze.com/b2/docs/
- **S3 API Compatibility**: https://www.backblaze.com/b2/docs/s3_compatible_api.html
- **Coolify Documentation**: https://coolify.io/docs

