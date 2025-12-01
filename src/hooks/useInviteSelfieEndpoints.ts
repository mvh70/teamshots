'use client'

import { useCallback } from 'react'

export function useInviteSelfieEndpoints(token: string) {
  const uploadEndpoint = useCallback(async (file: File): Promise<{ key: string; url?: string }> => {
    const ext = file.name.split('.')?.pop()?.toLowerCase() || ''
    const res = await fetch(`/api/uploads/proxy?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'x-file-content-type': file.type,
        'x-file-extension': ext,
        'x-file-type': 'selfie'
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
  }, [token])

  const saveEndpoint = useCallback(async (key: string): Promise<string | undefined> => {
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
  }, [token])

  return { uploadEndpoint, saveEndpoint }
}

