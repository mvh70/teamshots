# Email Setup Guide

## Overview

TeamShots uses [Resend](https://resend.com) for sending transactional emails. This includes waitlist welcome emails and future notification emails.

## Required Environment Variables

Add these to your `.env` file in the project root:

```bash
# Resend Email Service
RESEND_API_KEY="re_..."

# Base URL for email links
NEXT_PUBLIC_BASE_URL="https://www.teamshots.vip"
```

**Note:** Email addresses (from, reply-to) are automatically pulled from `src/config/brand.ts` for consistency across the application.

## Getting Started with Resend

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Navigate to API Keys section
4. Create a new API key

### 2. Verify Your Domain

To send emails from `@teamshots.vip`, you need to verify the domain:

1. In Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Enter `teamshots.vip`
4. Add the provided DNS records to your domain registrar:
   - SPF record (TXT)
   - DKIM records (TXT)
   - DMARC record (TXT, optional but recommended)

### 3. Configure Environment Variables

Update your `.env` file with:
- Your Resend API key
- The base URL for your application

Email addresses are automatically configured from `src/config/brand.ts`:
- **From:** `hello@teamshots.vip` (configured in `brand.ts`)
- **Reply-To:** `support@teamshots.vip` (configured in `brand.ts`)

## Email Templates

### Current Templates

#### 1. Waitlist Welcome Email (`WaitlistWelcome.tsx`)

**Purpose**: Sent immediately when someone joins the waitlist

**Features**:
- Bilingual support (English & Spanish)
- Professional design with brand colors
- Explains what happens next
- Highlights value propositions
- Includes unsubscribe link

**Trigger**: When `/api/waitlist` receives a valid signup

**Location**: `src/emails/WaitlistWelcome.tsx`

### Future Templates (TODO)

- Launch notification email (with discount code)
- Password reset email
- Account verification email
- Receipt/invoice email

## Email Service Functions

Located in `src/lib/email.ts`:

### `sendWaitlistWelcomeEmail()`

```typescript
await sendWaitlistWelcomeEmail({
  email: 'user@example.com',
  locale: 'en' // or 'es'
});
```

Sends a welcome email to new waitlist signups.

### `sendWaitlistLaunchEmail()` (TODO)

Will notify waitlist members when we launch.

## Testing Emails Locally

### Option 1: Use Resend Test Mode

Resend automatically provides a test environment in development.

### Option 2: Use a Testing Email Service

For local testing without sending real emails:

1. Install MailHog or similar SMTP testing tool
2. Update Resend configuration to use test SMTP
3. View emails in MailHog web interface

### Option 3: Send to Your Own Email

Set up Resend with your personal domain for testing:

```bash
RESEND_FROM_EMAIL="Test <test@yourdomain.com>"
```

## Production Checklist

Before deploying to production:

- [ ] Domain is verified in Resend
- [ ] DNS records are properly configured
- [ ] API key is added to production environment variables
- [ ] "From" email uses the verified domain
- [ ] Reply-to email is monitored
- [ ] Test sending emails from production
- [ ] Verify emails are not going to spam
- [ ] Set up email analytics in Resend dashboard

## Monitoring

### Resend Dashboard

Monitor email delivery in the Resend dashboard:
- Delivery rates
- Open rates (if enabled)
- Bounce rates
- Spam complaints

### Logs

Email sending is logged in the application:
- Success: `console.log('Welcome email sent successfully')`
- Errors: `console.error('Error sending welcome email')`

## Troubleshooting

### Emails Not Sending

1. Check API key is correct in `.env`
2. Verify domain is confirmed in Resend
3. Check logs for error messages
4. Verify DNS records are propagated (can take 24-48 hours)

### Emails Going to Spam

1. Verify SPF, DKIM, and DMARC records
2. Use a verified domain (not @gmail.com, @yahoo.com, etc.)
3. Avoid spam trigger words in subject/content
4. Ensure proper unsubscribe link
5. Monitor sender reputation in Resend

### Rate Limits

Resend free tier limits:
- 100 emails per day
- 3,000 emails per month

Upgrade to paid plan for production use.

## Cost Estimate

Resend pricing (as of 2025):
- Free tier: 100 emails/day, 3,000/month
- Pro tier: $20/month for 50,000 emails
- Scale: Custom pricing

For waitlist phase, free tier should be sufficient.

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate API keys** periodically
4. **Monitor for unauthorized usage** in Resend dashboard
5. **Use different API keys** for dev/staging/production

## Support

- Resend Documentation: https://resend.com/docs
- Resend Status: https://status.resend.com
- TeamShots Support: support@teamshots.vip

