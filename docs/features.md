# Features: MVP Scope

## Phased Launch

### Phase 1: Waitlist
- Landing page (www.teamshots.vip)
- Pricing page (show future pricing)
- Waitlist signup form with email collection
- Email notification: "Thanks for joining!"

### Phase 2: Full MVP
All features below

---

## Core Features

*See [Role System Implementation](ROLE_SYSTEM_IMPLEMENTATION.md) for detailed role definitions and permissions.*

### How it works (8 steps)
1. Team admin creates team context (background, logo, style, expression)
2. Team admin invites team members with 24hr tokens + credit allocation
3. Team members upload selfies (no signup required)
4. Team members choose: Personal use OR Team use
5. System generates photos with selected context
6. Team members review & approve/regenerate
7. Team admin views approved photos only
8. Team admin can regenerate all photos with new contexts

### 1. Photo Upload
- Single person per photo
- Face clearly visible (validation)
- JPG/PNG support
- Drag-drop or file picker

### 2. Style Selection
**6 Customizable Categories:**
1. **Background**: Office, neutral, gradient, custom upload
2. **Branding**: Logo placement (background, clothing, elements)
3. **Style**: 6 presets (Corporate, Casual, Creative, Tech, Executive, Artistic)
4. **Clothing**: Style, accessories, colors
5. **Expression**: Professional, friendly, confident
6. **Lighting**: Natural, studio, dramatic

**Admin Control**: Each category can be set as predefined (admin-controlled) or user choice

**Routes**:
- Personal Photo Styles: `/app/styles/personal`
- Team Photo Styles: `/app/styles/team`

**Package-aware UI**:
- The styles UI adapts based on the active `packageId`. Packages control which fields are visible, how settings are persisted, and how prompts are generated.

### 3. Generation Type Selection
- **Personal Use**: Individual credits, full style control, private photos
- **Team Use**: Team credits, preset styles, admin visible
- Same uploaded photo can be used for both types
- Clear credit cost display (10 credits per generation)

### 4. Photo Style Management
**Team Users:**
- Team admins create reusable contexts (background, logo, style, expression)
- Required before inviting team members
- Multiple contexts per team (e.g., "Executive", "Casual Friday")
- Regenerate all team photos with new context

**Individual Users:**
- Create personal photo styles with 6 customizable categories
- Set default style for all generations
- No team management required

### 5. Generation & Review
- Generates 3-4 photo variations
- Up to 60 second processing
- Preview generated photos and logo placement options
- Download selected image (1024x1024px)
- Regenerate with style changes (costs 1 credit)
- Team admin can bulk regenerate all photos with new context

### 6. Account & Billing
- Email/password authentication with OTP verification and magic links
- Team accounts with team management
- Team member token-based invites (24hr expiration, no signup required)
- Context templates (reusable settings)
- Automated team scraping from team website
- Team domain verification
- Credit balance display (individual + team credits)
- Try Once purchase option
- Subscription plans (monthly/annual)
- Subscription management:
  - Upgrade plan (Try Once → Individual, Try Once → Pro, Individual → Pro)
  - Downgrade plan (Pro → Individual, effective at end of billing period)
  - Cancel subscription (immediate effect)
- Credit top-ups
- Credits roll over month-to-month
- Download history
- Language preference (EN/ES)

*See [Business Model](business_model) for detailed pricing structure including specific costs, credit packages, and subscription tiers.*  
*See [User Flows](user_flows) for authentication sign-up process and [Getting Started](getting_started_updated.md) for technical implementation details.*

### 6.5 Enhanced Team Member Credit System
- **Transaction-Based Credits**: All credit movements tracked in dedicated `CreditTransaction` table
- **Credit Types**: Team credits (admin-allocated) and individual credits (user-owned)
- **Full Audit Trail**: Every credit allocation, transfer, and usage is recorded with timestamps
- **Team Invites**: Credits automatically allocated when team members accept invites
- **Transfer System**: Team admins can transfer credits between team pool and team members
- **Real-time Balances**: Credit balances calculated from transaction history for accuracy
- **Admin Dashboard**: Credit management with bulk allocation and individual adjustments

*See [Business Model](business_model) for detailed credit system specifications including default allocations, usage rules, and prioritization logic.*

### 6.6 Photo Consent & Approval Workflow
- Consent required before selfie upload
- Consent covers all Teamshots processing and service improvements
- Team member must approve generated photo before database save
- Original selfie retained if photo rejected
- Generated photo deleted if rejected
- Audit log records rejection events for credit accounting

### 6.7 Content Moderation System
- **LLM-Based Validation**: Automated filtering for nudity and obscenity
- **Approval Flags**: userApproved and fitnessApproved for selfies, userApproved and adminApproved for generations
- **Team Admin Approval**: Required for all public-facing team photo generations
- **User Feedback**: Clear error messages for rejected uploads with guidance
- **Audit Trail**: Moderation scores and results stored without inappropriate content
- **Performance**: Moderation integrated into upload flow with proper error handling

### 6.8 Logo Placement System
- Automated background removal from uploaded logos
- System generates multiple placement variations:
  - Background watermark (behind subject)
  - Clothing/apparel overlay
  - Physical item in scene (cup, desk item)
- Team admin or team member selects preferred variation

### 6.9 Team Admin Controls
- View approved team photos only
- Bulk regeneration with new contexts (uses team credit pool)
- Manual credit adjustment per team member
- View team progress and approval status
- **Team Member Management**:
  - Promote/demote team members to/from admin roles
  - Remove team members from team (with safety checks)
  - Resend expired team invitations
  - Revoke pending team invitations
- **Role-Based Access Control**: Admin-only features properly protected


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
- Team composite photos â†' MVP2
- Batch processing
- Video/animated photos
- Post-download editing
- Integrations (website builders, HR systems)
- Free tier or trial

---

## How to add a new style package

1. Create package definitions under `src/domain/style/packages/`: export a client-facing config and a server variant (see `headshot1` for templates).
2. Register the package in `src/domain/style/packages/index.ts`.
3. Use it by passing `packageId='myPackage'` to `PhotoStyleSettings` and to the save/load service.
4. Build prompts inside the package’s `promptBuilder` to fully control generation behavior.