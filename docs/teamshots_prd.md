# PRD: AI Team Photo Generator
**Version:** 1.0 | **Date:** Oct 2025 | **Status:** Draft

## Problem
Companies waste time and money coordinating photoshoots for team pages. Remote teams can't gather physically. New hires delay website updates.

## Solution
Upload any photo â†’ Get professional team photos in 60 seconds using AI.

## Goals
- Launch functional MVP in 6-8 weeks
- Validate market demand and pricing
- Maintain clean, reusable codebase for future projects (boilerplate-ready)

## Target Users
- Individual employees needing professional headshots
- Remote teams without access to photographers
- Startups with frequent new hires
- HR/Marketing uploading on behalf of teams

## MVP Scope
**In:**
- **Waitlist phase:** Landing + pricing pages with email signup (teamshots.vip purchased)
- Individual photo upload & generation (3-4 variations)
- Company accounts with team management
- Team member invitation system (email-based, guest uploads)
- Context templates (reusable background/style/logo settings)
- Automated team scraping from company website
- 5 style presets + custom backgrounds
- Credit-based pricing: Try Once + 2 subscription tiers with top-ups
- Credits roll over, never expire
- **Photo retention policy:**
  - Try Once: 30 days from generation
  - Subscriptions: Active period + 30 days after expiration
- Email/password authentication with OTP verification and magic links
- Company domain verification
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
- **Secondary:** Photos generated per user, subscription conversion rate

## Timeline
**Target: 4-6 weeks to launch**

### Phased Launch Strategy

**Week 1: Foundation + Waitlist**
- Days 1-2: Infrastructure, landing page, waitlist signup â†’ **LAUNCH WAITLIST**
- Days 3-4: Auth, database, app shell, i18n
- Days 5-7: Stripe, credit system, purchase flows

**Week 2: Core Feature + Launch**
- Days 8-10: S3, upload, Gemini integration, generation flow
- Days 11-12: Review UI, download, history, credit deduction
- Day 13: Polish, onboarding, emails
- Day 14: **BETA LAUNCH** to waitlist users

**Public launch:** After 1 week of beta feedback

## Open Questions
- [ ] Final pricing tiers and credit costs
- [ ] Gemini API rate limits/pricing
- [ ] Launch channels
- [ ] Legal: Copyright terms for AI-generated photos