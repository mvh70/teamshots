// Shared upload helper functions

// Shared helper function for promoting uploads (used by both single and multiple uploads)
export const promoteUploads = async (uploads: { key: string; url?: string }[]): Promise<{ key: string; selfieId?: string }[]> => {
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
            body: JSON.stringify({ tempKey: upload.key }),
            credentials: 'include'
          })
          if (promoteRes.ok) {
            const { key, selfieId } = await promoteRes.json() as { key: string; selfieId?: string }
            return { key, selfieId }
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

  // Log results for debugging
  console.log('[promoteUploads] Promotion results:', successfulResults)

  return successfulResults
}
