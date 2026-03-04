import { useCallback } from 'react'
import { isRecord } from '@/lib/type-guards'
import type { InviteData } from '@/types/invite'

interface InviteValidationError {
  errorText: string
  expired: boolean
  emailResent: boolean
  message?: string
}

interface InviteValidationResult {
  invite: InviteData | null
  error: InviteValidationError | null
}

export function useInviteValidation(token: string) {
  return useCallback(async (): Promise<InviteValidationResult> => {
    if (!token) {
      return {
        invite: null,
        error: {
          errorText: 'Failed to validate invite',
          expired: false,
          emailResent: false,
        },
      }
    }

    try {
      const response = await fetch('/api/team/invites/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()
      if (!isRecord(data)) {
        return {
          invite: null,
          error: {
            errorText: 'Invalid invite response',
            expired: false,
            emailResent: false,
          },
        }
      }

      if (response.ok) {
        if (!isRecord(data.invite)) {
          return {
            invite: null,
            error: {
              errorText: 'Invalid invite payload',
              expired: false,
              emailResent: false,
            },
          }
        }

        return {
          invite: data.invite as unknown as InviteData,
          error: null,
        }
      }

      const errorText = typeof data.error === 'string' ? data.error : null
      const message = typeof data.message === 'string' ? data.message : undefined

      return {
        invite: null,
        error: {
          errorText: errorText || message || 'Failed to validate invite',
          expired: Boolean(data.expired),
          emailResent: Boolean(data.emailResent),
          message,
        },
      }
    } catch {
      return {
        invite: null,
        error: {
          errorText: 'Failed to validate invite',
          expired: false,
          emailResent: false,
        },
      }
    }
  }, [token])
}
