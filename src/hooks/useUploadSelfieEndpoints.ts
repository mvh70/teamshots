'use client'

import { useCallback, useState, useEffect, useMemo } from 'react'

type TokenType = 'invite' | 'handoff' | null

interface UseUploadSelfieEndpointsResult {
  uploadEndpoint: (file: File) => Promise<{ key: string; url?: string }>
  saveEndpoint: (key: string) => Promise<string | undefined>
  tokenType: TokenType
  isReady: boolean
}

/**
 * Hook that provides upload endpoints for the standalone selfie upload page.
 * If tokenType is provided, skips validation. Otherwise auto-detects token type.
 */
export function useUploadSelfieEndpoints(
  token: string,
  providedTokenType?: 'invite' | 'handoff'
): UseUploadSelfieEndpointsResult {
  const [detectedTokenType, setDetectedTokenType] = useState<TokenType>(null)
  const [isReady, setIsReady] = useState(!!providedTokenType)

  const tokenType = useMemo<TokenType>(() => providedTokenType ?? detectedTokenType, [providedTokenType, detectedTokenType])

  // Detect token type on mount (only if not provided)
  useEffect(() => {
    // Skip detection if tokenType was provided
    if (providedTokenType) return

    async function detectTokenType() {
      try {
        // Try handoff token validation first (more likely in this context)
        const handoffResponse = await fetch(`/api/mobile-handoff/validate?token=${token}`)
        if (handoffResponse.ok) {
          setDetectedTokenType('handoff')
          setIsReady(true)
          return
        }

        // Try invite token validation
        const inviteResponse = await fetch('/api/team/invites/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        if (inviteResponse.ok) {
          setDetectedTokenType('invite')
          setIsReady(true)
          return
        }

        // Neither worked - set ready anyway so error can be shown
        setIsReady(true)
      } catch {
        setIsReady(true)
      }
    }

    detectTokenType()
  }, [token, providedTokenType])

  const uploadEndpoint = useCallback(async (file: File): Promise<{ key: string; url?: string }> => {
    const ext = file.name.split('.')?.pop()?.toLowerCase() || ''
    
    // Build URL based on token type
    const queryParam = tokenType === 'handoff' 
      ? `handoffToken=${encodeURIComponent(token)}`
      : `token=${encodeURIComponent(token)}`
    
    const res = await fetch(`/api/uploads/proxy?${queryParam}`, {
      method: 'POST',
      headers: {
        'x-file-content-type': file.type,
        'x-file-extension': ext,
        'x-file-type': 'selfie',
        // Also include as header for redundancy
        ...(tokenType === 'handoff' 
          ? { 'x-handoff-token': token }
          : { 'x-invite-token': token })
      },
      body: file,
      credentials: 'include'
    })
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || 'Upload failed')
    }
    
    const { key } = await res.json() as { key: string }
    const preview = URL.createObjectURL(file)
    return { key, url: preview }
  }, [token, tokenType])

  const saveEndpoint = useCallback(async (key: string): Promise<string | undefined> => {
    if (tokenType === 'handoff') {
      // For handoff tokens, use the handoff-specific save endpoint
      const response = await fetch('/api/mobile-handoff/selfies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, selfieKey: key }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to save selfie')
      }

      const data = await response.json() as { selfie?: { id: string } }
      return data.selfie?.id
    } else {
      // For invite tokens, use the existing team member selfies endpoint
      const response = await fetch('/api/team/member/selfies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, selfieKey: key }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to save selfie')
      }

      const data = await response.json() as { selfie?: { id: string } }
      return data.selfie?.id
    }
  }, [token, tokenType])

  return { uploadEndpoint, saveEndpoint, tokenType, isReady }
}

