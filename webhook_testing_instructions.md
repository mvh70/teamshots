# How to Check Where Stripe is Sending Webhooks

## In Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/webhooks
2. Look for your webhook endpoint
3. Check the "Endpoint URL" - it should be:
   - For local dev: You need to use Stripe CLI (see below)
   - For production: `https://app.teamshots.vip/api/stripe/webhook`

## For Local Development (You Need Stripe CLI)

Stripe webhooks can't reach `http://localhost` directly. You have two options:

### Option 1: Use Stripe CLI (Recommended for Local Dev)

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. This gives you a webhook signing secret that starts with `whsec_...`
5. Add it to your `.env` file:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...your_key_here
   ```

### Option 2: Check Stripe Dashboard Logs

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click on any webhook event
3. Check if it was successful or failed
4. View the request/response logs

## Current Issue

The dashboard is crashing, which is unrelated to webhooks. Let's fix that first.

Your webhook endpoint is at: `http://localhost:3000/api/stripe/webhook`
