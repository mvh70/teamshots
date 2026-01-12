import { useState, useCallback, useEffect } from 'react'
import { useSelfieUploads } from './useSelfieUploads'
import { useSelfieSelection } from './useSelfieSelection'

interface UploadListItem {
  id: string
  uploadedKey: string
  validated: boolean
  createdAt: string
  hasGenerations: boolean
  selfieType?: string | null
  selfieTypeConfidence?: number | null
  personCount?: number | null
  isProper?: boolean | null
  improperReason?: string | null
}

interface Selfie {
  id: string
  key: string
  url: string
  uploadedAt: string
  used?: boolean
  status?: 'pending' | 'approved' | 'rejected'
}

interface UseSelfieManagementOptions {
  // Invite flow options
  token?: string
  inviteMode?: boolean
  customUploadEndpoint?: (file: File) => Promise<{ key: string; url?: string }>
  customSaveEndpoint?: (key: string) => Promise<string | undefined>

  // Auto-selection for generation flow
  autoSelectNewUploads?: boolean

  // Callbacks
  onSelfiesApproved?: (results: { key: string; selfieId?: string }[]) => void
  onUploadError?: (error: string) => void
}

interface BaseResult {
  mode: 'individual' | 'invite'
  selectedIds: string[]
  selectedSet: Set<string>
  loading: boolean
  error: string | null
  loadUploads: () => void
  toggleSelect: (id: string, selected: boolean) => Promise<void>
  loadSelected: () => Promise<void>
}

interface IndividualResult extends BaseResult {
  uploads: UploadListItem[]
  handlePhotoUpload?: (file: File) => Promise<{ key: string; url?: string }>
  handleSelfiesApproved?: (results: { key: string; selfieId?: string }[]) => Promise<void>
}

interface InviteResult extends BaseResult {
  uploads: Selfie[]
  handlePhotoUpload: (file: File) => Promise<{ key: string; url?: string }>
  handleSelfiesApproved: (results: { key: string; selfieId?: string }[]) => void
}

export type UseSelfieManagementResult = IndividualResult | InviteResult

export function useSelfieManagement(options: UseSelfieManagementOptions = {}): UseSelfieManagementResult {
  const {
    token,
    inviteMode = false,
    customUploadEndpoint,
    autoSelectNewUploads = false,
    onSelfiesApproved,
    onUploadError
  } = options

  // Always use hooks (conditionally calling them causes issues)
  const uploadsHook = useSelfieUploads()
  const selectionHook = useSelfieSelection({ token })

  // Invite-specific state
  const [inviteUploads, setInviteUploads] = useState<Selfie[]>([])
  const [inviteLoading, setInviteLoading] = useState(!inviteMode)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Invite flow: fetch selfies from team member API
  const fetchInviteUploads = useCallback(async () => {
    if (!inviteMode || !token) return

    try {
      setInviteLoading(true)
      setInviteError(null)
      const response = await fetch(`/api/team/member/selfies?token=${token}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setInviteUploads(data.selfies || [])
      } else {
        setInviteError('Failed to fetch selfies')
      }
    } catch (error) {
      console.error('Error fetching invite uploads:', error)
      setInviteError('Failed to fetch selfies')
    } finally {
      setInviteLoading(false)
    }
  }, [inviteMode, token])

  // Individual flow: standard upload handler
  const handleIndividualPhotoUpload = useCallback(async (file: File): Promise<{ key: string; url?: string }> => {
    try {
      const ext = file.name.split('.')?.pop()?.toLowerCase() || ''
      const res = await fetch('/api/uploads/temp', {
        method: 'POST',
        headers: {
          'x-file-content-type': file.type,
          'x-file-extension': ext
        },
        body: file,
        credentials: 'include'
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Temp upload failed')
      }
      const data = await res.json() as { tempKey: string }
      const url = URL.createObjectURL(file)
      return { key: data.tempKey, url }
    } catch (error) {
      console.error('Error during photo upload:', error)
      onUploadError?.(error instanceof Error ? error.message : 'Selfie upload failed. Please try again.')
      throw error
    }
  }, [onUploadError])

  // Individual flow: selfie approval handler
  const handleIndividualSelfiesApproved = useCallback(async (results: { key: string; selfieId?: string }[]) => {
    try {
      // Promote temp uploads to permanent selfies
      const { promoteUploads } = await import('@/lib/uploadHelpers')
      const promotedResults = await promoteUploads(results)

      // Auto-select newly uploaded selfies if enabled
      if (autoSelectNewUploads && promotedResults.length > 0) {
        for (const { selfieId } of promotedResults) {
          if (selfieId) {
            try {
              await selectionHook.toggleSelect(selfieId, true)
            } catch (error) {
              console.error('Error selecting newly uploaded selfie:', error)
            }
          }
        }
      }

      // Reload uploads to show new selfies
      await uploadsHook.loadUploads()

      // Call parent callback
      onSelfiesApproved?.(promotedResults)
    } catch (error) {
      console.error('Failed to handle approved selfies:', error)
      onUploadError?.('Failed to process approved selfies.')
    }
  }, [autoSelectNewUploads, selectionHook, uploadsHook, onSelfiesApproved, onUploadError])

  // Invite flow: custom upload handler
  const handleInvitePhotoUpload = useCallback(async (file: File): Promise<{ key: string; url?: string }> => {
    if (!customUploadEndpoint) {
      throw new Error('Upload endpoint not configured')
    }

    try {
      return await customUploadEndpoint(file)
    } catch (error) {
      onUploadError?.(error instanceof Error ? error.message : 'Upload failed')
      throw error
    }
  }, [customUploadEndpoint, onUploadError])

  // Invite flow: custom selfie approval handler
  const handleInviteSelfiesApproved = useCallback(async (results: { key: string; selfieId?: string }[]) => {
    // Auto-select newly uploaded selfies if enabled
    if (autoSelectNewUploads && results.length > 0) {
      for (const { selfieId } of results) {
        if (selfieId) {
          try {
            await selectionHook.toggleSelect(selfieId, true)
          } catch (error) {
            console.error('Error selecting newly uploaded selfie:', error)
          }
        }
      }
    }

    // Reload uploads to show new selfies
    await fetchInviteUploads()

    // Await parent callback to ensure state updates propagate
    if (onSelfiesApproved) {
      await onSelfiesApproved(results)
    }
  }, [autoSelectNewUploads, selectionHook, fetchInviteUploads, onSelfiesApproved])

  // Initialize data based on flow type - ONLY RUN ONCE
  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state */
  useEffect(() => {
    if (inviteMode) {
      fetchInviteUploads()
    } else {
      uploadsHook.loadUploads()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run on mount
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  // Selected selfies reload is handled in handleInviteSelfiesApproved callback

  // Wrap returned functions with stable callbacks to prevent infinite loops
  const stableToggleSelect = useCallback((id: string, selected: boolean) => {
    return selectionHook.toggleSelect(id, selected)
  }, [selectionHook])

  const stableLoadSelected = useCallback(() => {
    return selectionHook.loadSelected()
  }, [selectionHook])

  const stableLoadUploads = useCallback(() => {
    if (inviteMode) {
      return fetchInviteUploads()
    }
    return uploadsHook.loadUploads()
  }, [inviteMode, fetchInviteUploads, uploadsHook])

  if (inviteMode) {
    return {
      mode: 'invite',
      uploads: inviteUploads,
      selectedIds: selectionHook.selectedIds,
      selectedSet: selectionHook.selectedSet,
      loading: inviteLoading,
      error: inviteError,
      loadUploads: stableLoadUploads,
      toggleSelect: stableToggleSelect,
      loadSelected: stableLoadSelected,
      handlePhotoUpload: handleInvitePhotoUpload,
      handleSelfiesApproved: handleInviteSelfiesApproved
    } as InviteResult
  } else {
    return {
      mode: 'individual',
      uploads: uploadsHook?.uploads || [],
      selectedIds: selectionHook.selectedIds,
      selectedSet: selectionHook.selectedSet,
      loading: uploadsHook?.loading || false,
      error: uploadsHook?.error || null,
      loadUploads: stableLoadUploads,
      toggleSelect: stableToggleSelect,
      loadSelected: stableLoadSelected,
      handlePhotoUpload: handleIndividualPhotoUpload,
      handleSelfiesApproved: handleIndividualSelfiesApproved
    } as IndividualResult
  }
}
