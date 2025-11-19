# PRD: AI Team Photo Generator
**Version:** 1.0 | **Date:** Oct 2025 | **Status:** Draft

## Problem
Companies waste time and money coordinating photoshoots for team pages. Remote teams can't gather physically. New hires delay website updates.

## Solution
Upload any photo â†’ Get professional team photos in 60 seconds using AI.

## Goals
- Launch functional MVP
- Validate market demand and pricing
- Maintain clean, reusable codebase for future projects (boilerplate-ready)

## Target Users
- Individual employees needing professional headshots
- Remote teams without access to photographers
- Startups with frequent new hires
- HR/Marketing uploading on behalf of teams
- Team admins managing team photo consistency

## MVP Scope
**In:**
- **Waitlist phase:** Landing + pricing pages with email signup (teamshots.vip purchased)
- Individual photo upload & generation (single photo with logo placement variations)
- Team accounts with team management
- Team member token-based invitation system (24hr tokens, no signup required)
- Context templates (reusable background/style/logo settings)
- Generation type selection (personal vs team use)
- Automated team scraping from team website
- 5 style presets + custom backgrounds
- Domain-based pricing: photoshotspro.com (individual) / teamshotspro.com (team)
- Photo packages: Try Once + Individual + Team Small + Team Large
- **Photo retention policy:**
  - All plans: Photos retained indefinitely
- Per-team-member photo allocation (5 default, admin adjustable)
- Photo consent & approval workflow (consent before upload, approval before save)
- Logo placement variations (multiple positions generated)
- Team-level photo pool for bulk operations
- **Enhanced Photo System**: Separate team photos (admin-allocated) and individual photos (user-owned)
- **Content Moderation**: LLM-based validation for inappropriate content (nudity/obscenity filtering)
- Admin views approved photos only
- Context regeneration (admin can regenerate all team photos with new contexts)
- Audit trail for photo usage (tracks rejections without storing photos)
- Email/password authentication with OTP verification and magic links
- Team domain verification
- Bilingual support (EN/ES) with next-intl (machine translation for beta)
- Basic onboarding
- Payment integration (Stripe)
- S3 storage for images
- Placeholder branding (logo/assets post-MVP)

**Out (MVP/Post-Launch):**
- OAuth providers (add after beta)
- Native Spanish translation (improve after beta)
- Professional branding assets

**Out (MVP2+):**
- Team composite photos (multiple people)
- Batch processing
- Integrations
- Free tier
- Additional languages

## Success Metrics
- **Primary:** Revenue (MRR + credits)
- **Secondary:** Photos generated per user, subscription conversion rate, approval rate (generated photos accepted vs. rejected)

## Launch Strategy

### Phased Launch Approach

**Phase 1: Waitlist**
- Infrastructure setup
- Landing page and pricing page
- Waitlist signup functionality
- Email collection and notifications

**Phase 2: Core Features**
- Authentication system
- Database setup and app shell
- Payment integration and credit system
- Photo upload and generation workflow

**Phase 3: Polish & Launch**
- Review and download functionality
- Onboarding flow
- Error handling and notifications
- Beta launch to waitlist users

## Open Questions
- [ ] Final pricing tiers and credit costs
- [ ] Gemini API rate limits/pricing
- [ ] Launch channels
- [ ] Legal: Copyright terms for AI-generated photos