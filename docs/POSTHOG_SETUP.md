# PostHog Analytics Setup

This document describes the PostHog analytics integration for TeamShots.

## Overview

PostHog is integrated to track user behavior, feature usage, and application performance. The integration includes:

- Automatic page view tracking
- User identification on login/logout
- Custom event tracking for key user actions
- Development mode debugging

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY="your-posthog-project-key"
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
```

### Getting Your PostHog Key

1. Sign up for a PostHog account at [posthog.com](https://posthog.com)
2. Create a new project
3. Copy your Project API Key from the project settings
4. Add it to your environment variables

## Implementation Details

### Core Files

- `src/lib/posthog.ts` - PostHog initialization and configuration
- `src/components/PostHogProvider.tsx` - Provider component for page view tracking
- `src/hooks/useAnalytics.ts` - Custom hook for analytics functions
- `src/components/SessionProvider.tsx` - User identification on login/logout

### Key Features

#### Automatic Page View Tracking
Page views are automatically tracked when users navigate between pages.

#### User Identification
Users are automatically identified in PostHog when they log in, and reset when they log out.

#### Custom Event Tracking
Use the `useAnalytics` hook to track custom events:

```typescript
import { useAnalytics } from '@/hooks/useAnalytics'

function MyComponent() {
  const { track } = useAnalytics()
  
  const handleClick = () => {
    track('button_clicked', {
      button_name: 'subscribe',
      page: 'pricing'
    })
  }
  
  return <button onClick={handleClick}>Subscribe</button>
}
```

## Tracked Events

### Selfie Upload Flow
- `selfie_upload_started` - When user starts uploading a selfie
- `selfie_upload_success` - When selfie upload completes successfully
- `selfie_upload_failed` - When selfie upload fails
- `selfie_approval_failed` - When selfie approval fails
- `selfie_rejected` - When user rejects a selfie
- `selfie_retake` - When user chooses to retake a selfie

### User Actions
- `$pageview` - Automatic page view tracking
- `$identify` - User identification on login
- `$reset` - User reset on logout

## Development

### Debug Mode
In development mode, PostHog debug mode is automatically enabled, providing detailed logging in the browser console.

### Testing
To test analytics in development:

1. Open browser developer tools
2. Navigate to the Console tab
3. Look for PostHog debug messages
4. Check the Network tab for requests to PostHog

## Production Considerations

### Privacy
- PostHog is configured with `person_profiles: 'identified_only'` to respect user privacy
- Only identified users have detailed profiles created

### Performance
- PostHog loads asynchronously and doesn't block page rendering
- Page view tracking is handled manually to avoid duplicate events

### Data Retention
Configure data retention policies in your PostHog project settings according to your privacy requirements.

## Troubleshooting

### Common Issues

1. **Events not appearing in PostHog**
   - Check that `NEXT_PUBLIC_POSTHOG_KEY` is set correctly
   - Verify the PostHog host URL is correct
   - Check browser console for errors

2. **User identification not working**
   - Ensure the user is logged in through NextAuth
   - Check that the session contains user ID and email

3. **Page views not tracking**
   - Verify PostHogProvider is wrapped around your app
   - Check that navigation is happening through Next.js router

### Debug Commands

```bash
# Check if PostHog is loaded
console.log(window.posthog)

# Manually track an event
window.posthog.capture('test_event', { test: true })

# Check current user
console.log(window.posthog.get_distinct_id())
```

## Analytics Dashboard

Access your PostHog dashboard at [app.posthog.com](https://app.posthog.com) to:

- View real-time events
- Create custom dashboards
- Set up funnels and cohorts
- Configure feature flags
- Set up alerts and notifications
