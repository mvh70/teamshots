import { Logger } from '@/lib/logger'

interface CaptureServerEventParams {
  event: string
  distinctId: string
  properties?: Record<string, unknown>
}

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com').replace(/\/+$/, '')

export async function captureServerEvent({
  event,
  distinctId,
  properties = {},
}: CaptureServerEventParams) {
  if (!POSTHOG_KEY) {
    Logger.debug('PostHog key missing, skipping server event', { event })
    return
  }

  try {
    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: {
          distinct_id: distinctId,
          $source: 'server',
          ...properties,
        },
      }),
    })

    if (!response.ok) {
      const message = await response.text().catch(() => 'Unable to read response')
      Logger.warn('PostHog server capture failed', {
        event,
        status: response.status,
        message,
      })
    }
  } catch (error) {
    Logger.error('PostHog server capture error', {
      event,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}


