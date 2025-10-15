# Features: MVP Scope

## Phased Launch

### Phase 1: Waitlist (Days 1-2)
- Landing page (www.teamshots.vip)
- Pricing page (show future pricing)
- Waitlist signup form with email collection
- Email notification: "Thanks for joining!"

### Phase 2: Full MVP (Days 3-14)
All features below

---

## Core Features

### How it works (5 steps)
1. Define background scene (or upload)
2. Upload logo (optional)
3. Choose style (formal/casual) or upload reference
4. Team uploads selfies
5. Results: consistent, on‑brand headshots

### 1. Photo Upload
- Single person per photo
- Face clearly visible (validation)
- JPG/PNG support
- Drag-drop or file picker

### 2. Style Selection
**5 Presets:**
1. Corporate Professional
2. Casual Modern  
3. Creative Agency
4. Tech Startup
5. Executive Formal

### 3. Background Options
- Upload custom background
- Generate from text prompt
- 5 standard presets (office, neutral, gradient, branded, outdoor)

### 4. Branding (Optional)
- Add company logo to clothing/background
- Adjust clothing style (formal, business casual, casual)

### 5. Generation & Review
- Generates 3-4 variations (3-4 credits)
- Up to 60 second processing
- Preview all variations
- Download selected image (1024x1024px)
- Regenerate option (consumes more credits)

### 6. Account & Billing
- Email/password authentication (OAuth post-MVP)
- Email verification required
- Credit balance display (shows credits + generation equivalent)
- Try Once purchase (one-time, no subscription)
- Subscription plans (monthly/annual)
- Credit top-ups (tier-specific pricing)
- Credits roll over month-to-month
- Download history
- Language preference (EN/ES)

### 7. Internationalization
- **Languages:** English & Spanish
- **Auto-detection:** Browser language on first visit
- **Manual switching:** Header dropdown
- **Persistence:** Language saved with user account
- **Scope:** All UI, emails, error messages, notifications
- **Error Messages:** All validation and system errors translated
- **Email Templates:** Welcome, password reset, receipts, notifications all in user's language
- **Currency/Dates:** Localized formatting (USD for EN, EUR/MXN for ES)

### 8. Onboarding
- Welcome flow (3 slides or 30s video)
- Sample photos to test with
- Guided first generation
- Tooltips on style selection

## Non-Functional Requirements

### Performance
- Page load: < 2s
- Generation: < 60s
- API response: < 200ms

### Security
- SSL/TLS encryption
- Input validation
- Secure payment processing

### Storage & Photo Retention
- **Try Once (One-time Purchase):** 
  - Uploaded photos: 30 days retention
  - Generated photos: 30 days retention from generation date
- **Subscription Plans (Starter/Pro):**
  - Uploaded photos: Retained while subscription is active
  - Generated photos: Retained while subscription is active + 30 days after subscription expires
  - Allows users to download their photos even after cancellation
- **User-downloaded:** History available until account deletion

## Out of Scope (MVP)
- Team composite photos â†’ MVP2
- Batch processing
- Video/animated photos
- Post-download editing
- Integrations (website builders, HR systems)
- Company/team accounts
- Free tier or trial