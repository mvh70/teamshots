# 🎯 Analytics Setup - Quick Reference

## ✅ What's Done (Code)

Your codebase is now configured to use **Google Tag Manager** to manage all analytics, including GA4.

**Code changes:**
- ✅ GTM container loaded in `src/app/layout.tsx`
- ✅ Helper functions created in `src/lib/analytics.ts`
- ✅ Direct GA4 loading removed (GTM manages it instead)
- ✅ **CSP updated** to allow GTM & GA domains (fixed console errors)
- ✅ CSP report endpoint created (`/api/csp-report`)
- ✅ Environment variables in `.env`:
  - `NEXT_PUBLIC_GTM_ID=GTM-NCSXZN23`
  - `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-00XLLSG3FF`

---

## 🚀 What You Need to Do (3 Steps)

### Step 1: Add GA4 Tag in GTM Dashboard (5 min)

**Detailed Guide:** `docs/gtm-ga4-setup-steps.md`

**Quick version:**
1. Go to https://tagmanager.google.com/
2. Select container: `GTM-NCSXZN23`
3. Tags → New → **"Google Analytics: GA4 Configuration"**
4. Measurement ID: `G-00XLLSG3FF`
5. Trigger: **All Pages**
6. **Submit** (publish)

### Step 2: Deploy to Production (5 min)

```bash
git add .
git commit -m "feat: Add Google Analytics & Tag Manager"
git push origin main
```

Make sure environment variables are set on production:
- Vercel: Settings → Environment Variables
- VPS: Check production `.env` file

### Step 3: Test It Works (2 min)

1. Visit www.teamshotspro.com
2. Open console (F12), type: `dataLayer` ✅
3. Check GA4 **Real-time reports** (NOT standard reports) ✅
4. You should see yourself appear within 10 seconds

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `docs/gtm-ga4-setup-steps.md` | **Step-by-step GTM setup** (with screenshots descriptions) |
| `docs/analytics-deployment-checklist.md` | **Complete deployment checklist** |
| `docs/test-analytics.md` | **Testing & troubleshooting guide** |
| `docs/google-analytics-gtm-setup.md` | **Full setup documentation** |
| `src/lib/analytics.ts` | **Helper functions for custom events** |

---

## 🎯 Quick Test Commands

**Browser console (F12):**

```javascript
// Check GTM is loaded
dataLayer

// Check gtag function (should return "function")
typeof gtag

// Send test event
gtag('event', 'test_event', { test: 'value' })
```

**In your code:**

```typescript
import { trackEvent, trackSignup, trackConversion } from '@/lib/analytics'

// Track any event
trackEvent('button_click', { button_name: 'cta' })

// Track signup
trackSignup('email')

// Track purchase
trackConversion('order_123', 29.99, 'USD')
```

---

## ⚡ Your IDs

Keep these handy:

```
GTM Container ID: GTM-NCSXZN23
GA4 Measurement ID: G-00XLLSG3FF
```

---

## 🐛 Troubleshooting

**Issue:** dataLayer is undefined
→ Check GTM tag is published (Submit, not just Save)

**Issue:** GA4 shows no data
→ Did you add GA4 Configuration Tag in GTM? (Most common!)

**Issue:** Works locally but not in production
→ Check environment variables are set on production server

**Full troubleshooting:** See `docs/analytics-deployment-checklist.md`

---

## ✅ Success Checklist

- [ ] GA4 tag added in GTM dashboard
- [ ] GTM changes published (Submit clicked)
- [ ] Code committed and pushed
- [ ] Deployed to production
- [ ] Environment variables verified on production
- [ ] Tested: `dataLayer` exists in console
- [ ] Tested: Real-time reports show traffic

---

## 🎉 You're All Set!

Once the 3 steps above are complete, your analytics will be fully operational.

**Most important:** Don't forget to add the GA4 Configuration Tag in GTM - that's what makes everything work!

---

## 🆘 Need Help?

1. Follow `docs/gtm-ga4-setup-steps.md` for GTM setup
2. Use `docs/analytics-deployment-checklist.md` for deployment
3. Check browser console for errors
4. Verify Real-time reports (not standard reports - those take 24-48h)

**The #1 issue:** Forgetting to click **Submit** in GTM (not just Save)
