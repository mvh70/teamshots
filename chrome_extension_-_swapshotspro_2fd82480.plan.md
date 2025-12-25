---
name: Chrome Extension - SwapShotsPro
overview: Build a Chrome extension that allows authenticated users to capture outfit images from websites or upload local files, directly into their SwapShotsPro account. Requires user login, simplifying architecture and ensuring cost control.
todos:
  - id: backend-schema
    content: Create ExtensionToken Prisma model and run migration
    status: pending
  - id: backend-auth-lib
    content: Implement extension authentication library with token validation
    status: pending
    dependencies:
      - backend-schema
  - id: backend-token-apis
    content: Create token management API endpoints (create/list/revoke)
    status: pending
    dependencies:
      - backend-auth-lib
  - id: backend-session-validation
    content: Build session validation endpoint for extension auth
    status: pending
    dependencies:
      - backend-auth-lib
  - id: backend-cors
    content: Configure CORS for chrome-extension:// origins on outfit endpoints
    status: pending
  - id: backend-extension-auth-outfit
    content: Update outfit upload endpoint to accept extension tokens
    status: pending
    dependencies:
      - backend-auth-lib
      - backend-cors
  - id: backend-generation-auth
    content: Update generation create endpoint to accept extension tokens
    status: pending
    dependencies:
      - backend-auth-lib
  - id: extension-setup
    content: Initialize Chrome extension project structure with TypeScript and webpack
    status: pending
  - id: extension-manifest
    content: Configure manifest.json with permissions and content scripts
    status: pending
    dependencies:
      - extension-setup
  - id: extension-auth-check
    content: Implement auth check: verify session/token or redirect to login
    status: pending
    dependencies:
      - extension-manifest
      - backend-session-validation
  - id: extension-context-menu
    content: Build context menu for right-click image capture (requires auth)
    status: pending
    dependencies:
      - extension-auth-check
  - id: extension-background-polling
    content: Implement background service worker polling for async generation results
    status: pending
    dependencies:
      - extension-setup
  - id: extension-popup-states
    content: Create popup UI (Login Prompt vs Active Upload)
    status: pending
    dependencies:
      - extension-auth-check
  - id: extension-payment-flow
    content: Implement website redirect for credits/subscription (no in-extension checkout needed)
    status: pending
    dependencies:
      - extension-popup-states
  - id: extension-build
    content: Configure webpack build and test loading in Chrome
    status: pending
    dependencies:
      - extension-context-menu
      - extension-popup-states
      - extension-background-polling
  - id: testing-auth-flow
    content: "Test auth flow: Install -> Redirect to Login -> Cookie Sync -> Ready"
    status: pending
    dependencies:
      - extension-build
      - backend-session-validation
  - id: testing-integration
    content: "Test complete flow: capture -> upload -> generate notification"
    status: pending
    dependencies:
      - testing-auth-flow
  - id: store-assets
    content: Create Chrome Web Store assets (icons, screenshots, promotional images)
    status: pending
  - id: store-submission
    content: Submit extension to Chrome Web Store for review
    status: pending
    dependencies:
      - testing-integration
      - store-assets
---

# Chrome Extension for SwapShotsPro Outfit Transfer

## Executive Summary

Build a **value-focused** Chrome extension that allows authenticated users to capture outfit images from any website and use them instantly in SwapShotsPro.

- **Mandatory Signup**: Users must have an account to use the extension (simplifies architecture, prevents abuse).
- **Right-click capture**: Authenticated users can capture outfits from any site.
- **Seamless Auth**: Extension automatically detects logged-in session or redirects to login.
- **Notification Loop**: Browser notifications when async generation is ready.

## Multi-Brand Architecture

**Critical**: This extension uses a **shared backend** serving multiple brands:

- teamshotspro.com
- photoshotspro.com
- swapshotspro.com
- coupleshotspro.com
- familyshotspro.com

**Strategy**: Create **separate Chrome extensions per brand** (better discoverability, branding, SEO) but use a **shared codebase** with brand-specific configuration.

**This plan uses SwapShotsPro as the reference implementation.**

## Current State Analysis

### What Exists (100% Complete)

- [src/domain/style/packages/outfit1/](src/domain/style/packages/outfit1/) - Full outfit1 package implementation
- [src/app/api/outfit/upload/route.ts](src/app/api/outfit/upload/route.ts) - Secure outfit upload
- [src/app/api/outfit/analyze-colors/route.ts](src/app/api/outfit/analyze-colors/route.ts) - Color extraction
- Session-based authentication via NextAuth.js

### What's Missing (Gaps for Chrome Extension)

**Backend Infrastructure:**

1. ExtensionToken database model (for persistent auth)
2. Extension token management APIs
3. CORS configuration for `chrome-extension://` origins
4. Session validation endpoint
5. Token auth support in Upload/Generation endpoints

**Frontend (Chrome Extension):**

1. Chrome extension project structure
2. Auth check logic (Cookie/Token)
3. "Please Login" state vs "Active" state UI
4. Context menu implementation
5. Background service worker for job polling

## Implementation Plan

### Phase 1: Backend Infrastructure (Week 1)

#### 1.1 Database Schema - ExtensionToken Model

Create Prisma migration for extension authentication tokens:

```prisma
model ExtensionToken {
  id          String    @id @default(cuid())
  userId      String
  token       String    @unique // Hashed token
  name        String?   // "Chrome Extension - MacBook Pro"
  scopes      String[]  @default(["outfit:upload"]) // Permissions
  lastUsedAt  DateTime?
  lastUsedIp  String?
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}
```

#### 1.2 Extension Authentication Library & APIs

Implement `validateExtensionToken` and `createExtensionToken`.
Create endpoints:
- `api/extensions/validate-session`: Checks cookie, returns token.
- `api/extensions/tokens/*`: Manage tokens.

#### 1.3 CORS & Endpoint Updates

- Allow `chrome-extension://` in CORS.
- Update `api/generations/create` and `api/outfit/upload` to accept `X-Extension-Token`.

### Phase 2: Chrome Extension Development (Week 2)

#### 2.1 Extension Project Structure

Multi-brand structure (`brands/swapshotspro`, `brands/teamshotspro`).

#### 2.2 Auth Flow (Simplified)

1. **Check**: Call `api/extensions/validate-session` (credentials: include).
2. **Success**: Store returned Token in `chrome.storage.local`.
3. **Fail**: Show "Log In" button -> Open website -> User logs in -> User clicks "Retry" in extension.

#### 2.3 Context Menu & Popup

- **Context Menu**: Only active if Token exists. "Use as SwapShots Outfit".
- **Popup**:
  - State A: "Please Log In"
  - State B: "Upload Outfit" (Drag & Drop / File Select)
  - State C: "Processing..."

#### 2.4 Background Polling

Service worker polls `api/generations/[id]` every 5s when a job is active.
On completion: `chrome.notifications.create` ("Your outfit is ready! Click to view").

### Phase 3: Testing & Deployment (Week 3)

- Local testing of Auth Loop.
- Production build scripts.
- Store assets & submission.

## Timeline Summary

**Week 1: Backend (15 hours)**
- Schema & Token Auth (8h)
- CORS & Endpoint Updates (4h)
- Testing (3h)

**Week 2: Extension (20 hours)**
- Setup & UI (8h)
- Auth Logic (4h)
- Context Menu & Upload (4h)
- Background Polling (4h)

**Week 3: Polish & Ship (10 hours)**
- Build scripts (2h)
- Assets (4h)
- Submission (4h)

**Total: ~45 hours** (Significantly reduced from guest-mode plan)