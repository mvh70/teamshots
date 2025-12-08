## Observability Setup Guide

This guide walks through setting up complete observability for production deployment.

## Overview

The application now includes:
- **Sentry**: Error tracking and performance monitoring
- **Enhanced Logging**: Structured JSON logs for production
- **Metrics**: Business and performance metrics
- **PostHog**: Already configured for analytics

---

## 1. Sentry Error Tracking

### Installation

```bash
npm install @sentry/nextjs
```

### Configuration

1. **Copy example config:**
   ```bash
   cp sentry.config.example.ts sentry.config.ts
   ```

2. **Get Sentry DSN:**
   - Sign up at https://sentry.io
   - Create a new Next.js project
   - Copy your DSN from Settings → Client Keys

3. **Set environment variables:**
   ```bash
   # .env.production
   NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   NEXT_PUBLIC_APP_VERSION=1.0.0
   ```

4. **Initialize in instrumentation.ts:**
   ```typescript
   // src/instrumentation.ts
   import { initializeSentry } from './sentry.config'

   export async function register() {
     if (process.env.NEXT_RUNTIME === 'nodejs') {
       // Existing startup checks
       const { validateEnvironment } = await import('./lib/startup-checks')
       validateEnvironment()

       // Initialize Sentry
       initializeSentry()
     }
   }
   ```

### Usage

```typescript
import { captureError, setUserContext } from '@/sentry.config'

// Set user context after login
setUserContext(user.id, user.email)

// Capture errors with context
try {
  // Your code
} catch (error) {
  captureError(error as Error, {
    generationId,
    packageId,
    userId
  })
}
```

---

## 2. Enhanced Logging

The enhanced logger is already implemented in `src/lib/logger-enhanced.ts`.

### Usage Examples

```typescript
import { EnhancedLogger, createLogger } from '@/lib/logger-enhanced'

// Basic logging
EnhancedLogger.info('User logged in', { userId, email })
EnhancedLogger.error('Generation failed', {
  generationId,
  error: error.message
})

// Scoped logger
const logger = createLogger('GenerationWorker', { workerId: '123' })
logger.info('Processing job', { jobId })
logger.error('Job failed', { error })

// Performance timing
EnhancedLogger.startTimer('generation-process')
// ... your code ...
EnhancedLogger.endTimer('generation-process', { generationId })

// With request context
const requestLogger = EnhancedLogger.withRequest(requestId)
requestLogger.info('Request received', { method, path })
```

### Production Output

In production, logs are output as structured JSON:

```json
{
  "timestamp": "2025-12-08T10:30:45.123Z",
  "level": "info",
  "message": "Generation completed",
  "generationId": "abc123",
  "duration": 45000,
  "packageId": "headshot1"
}
```

This format is compatible with log aggregation services like:
- **Datadog**: Automatic JSON parsing
- **CloudWatch**: Use CloudWatch Logs Insights
- **Elasticsearch**: Direct ingestion

---

## 3. Metrics Tracking

The metrics system is implemented in `src/lib/metrics.ts`.

### Usage Examples

```typescript
import { BusinessMetrics, PerformanceMetrics, measureAsync } from '@/lib/metrics'

// Business metrics
BusinessMetrics.userSignup('individual', 'en')
BusinessMetrics.generationCompleted('headshot1', 45000, true)
BusinessMetrics.creditTransaction('purchase', 50, 'stripe')

// Performance metrics
PerformanceMetrics.apiRequest('/api/generations', 'POST', 200, 250)
PerformanceMetrics.dbQuery('generation.create', 45)
PerformanceMetrics.queueJob('image-generation', 45000, true)

// Measure function execution
const result = await measureAsync(
  'process-image',
  async () => await processImage(imageId),
  { imageId, userId }
)
```

### Viewing Metrics

**PostHog (already configured):**
- Metrics are automatically sent as events with `metric:` prefix
- View in PostHog dashboard under Trends
- Create custom insights for key metrics

**Future: Datadog/CloudWatch:**
- Metrics are logged as structured JSON
- Parse logs and extract metric values
- Create dashboards from aggregated data

---

## 4. PostHog Server-Side Events

PostHog is already configured. Enhance it with additional tracking:

### Track Critical Events

```typescript
import { captureServerEvent } from '@/lib/analytics/server'

// Generation lifecycle
await captureServerEvent({
  event: 'generation_started',
  distinctId: userId,
  properties: {
    generationId,
    packageId,
    creditSource,
    timestamp: new Date().toISOString()
  }
})

await captureServerEvent({
  event: 'generation_completed',
  distinctId: userId,
  properties: {
    generationId,
    packageId,
    duration: durationMs,
    success: true,
    imagesGenerated: imageCount
  }
})

// Error tracking
await captureServerEvent({
  event: 'generation_failed',
  distinctId: userId,
  properties: {
    generationId,
    packageId,
    error: error.message,
    errorType: error.name
  }
})
```

---

## 5. Monitoring Dashboard Setup

### Key Metrics to Monitor

**Business Health:**
- User signups per day
- Generations per day
- Credit purchases per day
- Subscription conversions

**Performance:**
- API response times (p50, p95, p99)
- Generation completion times
- Database query times
- Error rates by endpoint

**System Health:**
- Queue depth and processing rate
- Redis connection status
- Database connection pool
- S3 upload/download success rates

### Recommended Dashboards

**1. Business Overview (PostHog)**
- DAU/MAU
- Signup conversion funnel
- Revenue metrics
- Generation volume trends

**2. Performance Dashboard (Sentry)**
- Transaction throughput
- Error rate trends
- Slowest endpoints
- Failed requests by type

**3. System Health (CloudWatch/Datadog)**
- CPU/Memory usage
- Queue metrics
- Database performance
- External API health

---

## 6. Alerting Setup

### Critical Alerts

**Immediate (PagerDuty/Opsgenie):**
- Error rate > 5% for 5 minutes
- All generations failing
- Database connection lost
- Redis connection lost
- Queue processing stopped

**High Priority (Slack):**
- API response time p95 > 2s
- Generation failure rate > 10%
- Credit transaction failures
- Stripe webhook failures

**Medium Priority (Email):**
- Disk space < 20%
- High memory usage (> 80%)
- Queue depth growing (> 1000 jobs)
- Unusual traffic patterns

### Sentry Alert Configuration

1. Go to Alerts → Create Alert Rule
2. Set conditions:
   - Error rate increased by 100%
   - New issue created
   - Slow transaction (> 2s)
3. Configure notifications (Slack, Email, PagerDuty)

---

## 7. Log Aggregation (Optional)

### Datadog Setup

```bash
# Add DD agent
npm install dd-trace

# Initialize at app start
// src/instrumentation.ts
import tracer from 'dd-trace'

tracer.init({
  service: 'teamshots-api',
  env: process.env.NODE_ENV,
  logInjection: true
})
```

### CloudWatch Logs (AWS)

If deploying to AWS:
- Logs automatically sent to CloudWatch
- Create log groups: `/aws/lambda/teamshots-api`
- Set up CloudWatch Insights queries
- Create metric filters for key events

---

## 8. Testing Observability

### Test Error Tracking

```typescript
// Create test endpoint
// src/app/api/test/error/route.ts
export async function GET() {
  throw new Error('Test error for Sentry')
}

// Visit /api/test/error and verify in Sentry dashboard
```

### Test Metrics

```typescript
// Log some test metrics
BusinessMetrics.userSignup('individual', 'en')
BusinessMetrics.generationCompleted('test', 1000, true)

// Check PostHog dashboard for metric:* events
```

### Test Logging

```bash
# Tail logs in production
# Heroku:
heroku logs --tail --app your-app-name

# Vercel:
vercel logs --follow

# Check for JSON structured logs
```

---

## 9. Deployment Checklist

Before going to production:

- [ ] Sentry DSN configured
- [ ] Sentry initialized in instrumentation.ts
- [ ] Enhanced logging enabled in critical paths
- [ ] Metrics tracking added to key flows
- [ ] PostHog events tracking critical business events
- [ ] Alerts configured in Sentry
- [ ] Log aggregation set up (Datadog/CloudWatch)
- [ ] Dashboards created for key metrics
- [ ] Test error tracking working
- [ ] Test metrics appearing in PostHog
- [ ] On-call rotation configured for critical alerts

---

## 10. Cost Estimates

**Sentry (Team Plan - $26/month):**
- 50K errors/month
- 10K transactions/month
- Session replay included
- Good for early production

**PostHog (Already using):**
- Generous free tier
- Pay only for extra usage

**Datadog (if needed - ~$15-50/month):**
- APM lite
- Log management
- Infrastructure monitoring

**Total: ~$26-76/month for comprehensive observability**

---

## Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [PostHog Server-Side Events](https://posthog.com/docs/integrate/server/node)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [Structured Logging Best Practices](https://www.datadoghq.com/blog/structured-logging/)
