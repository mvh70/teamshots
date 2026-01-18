// Shared upload helper functions

export interface UploadWithClassification {
  key: string
  url?: string
  selfieType?: string
  selfieTypeConfidence?: number
  personCount?: number
  isProper?: boolean
  improperReason?: string
}

export interface ClassificationData {
  selfieType?: string
  selfieTypeConfidence?: number
  personCount?: number
  isProper?: boolean
  improperReason?: string
  captureSource?: 'laptop_camera' | 'mobile_camera' | 'file_upload'
}

// Shared helper function for promoting uploads (used by both single and multiple uploads)
export const promoteUploads = async (
  uploads: { key: string; url?: string }[],
  classification?: ClassificationData
): Promise<{ key: string; selfieId?: string }[]> => {
  const promotionPromises = uploads
    .filter((upload): upload is { key: string; url?: string } => !!upload.key)
    .map(async (upload): Promise<{ key: string; selfieId?: string }> => {
      try {
        // Promote temp file to permanent storage if it's a temp key
        // Selfies are now marked as selected by default in the promote endpoint
        if (upload.key.startsWith('temp:')) {
          const promoteRes = await fetch('/api/uploads/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tempKey: upload.key,
              ...(classification?.selfieType && { selfieType: classification.selfieType }),
              ...(typeof classification?.selfieTypeConfidence === 'number' && {
                selfieTypeConfidence: classification.selfieTypeConfidence
              }),
              ...(typeof classification?.personCount === 'number' && {
                personCount: classification.personCount
              }),
              ...(typeof classification?.isProper === 'boolean' && {
                isProper: classification.isProper
              }),
              ...(classification?.improperReason && { improperReason: classification.improperReason }),
              ...(classification?.captureSource && { captureSource: classification.captureSource }),
            }),
            credentials: 'include'
          })
          if (promoteRes.ok) {
            const data = await promoteRes.json() as { key: string; selfieId?: string }
            return { key: data.key, selfieId: data.selfieId }
          } else {
            // If promote fails, return the temp key
            return { key: upload.key, selfieId: undefined }
          }
        } else {
          // Already permanent
          return { key: upload.key, selfieId: undefined }
        }
      } catch (error) {
        console.error('Error processing upload:', error)
        return { key: upload.key, selfieId: undefined }
      }
    })

  // Wait for all promotions to complete in parallel
  const successfulResults = await Promise.all(promotionPromises)

  return successfulResults
}
