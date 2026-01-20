/**
 * Face detection using BlazeFace model from TensorFlow.js
 * 
 * This provides accurate face detection that works across all skin tones,
 * unlike the previous skin-tone-based pixel analysis.
 * 
 * The model is dynamically loaded to avoid impacting initial bundle size (~200KB)
 */

type BlazeFaceModel = Awaited<ReturnType<typeof import('@tensorflow-models/blazeface').load>>
let model: BlazeFaceModel | null = null
let loadingPromise: Promise<BlazeFaceModel> | null = null

/**
 * Preload the face detection model in the background
 * Call this early in the user flow (e.g., on the selfie tips page)
 * to ensure the model is ready when the user reaches the selfie capture page
 *
 * This is a fire-and-forget operation - it starts loading but doesn't wait
 */
export function preloadFaceDetectionModel(): void {
  // Fire-and-forget: start loading but don't wait
  loadModel().catch(() => {
    // Silent fail - will retry on actual use
  })
}

/**
 * Load the BlazeFace model (lazy-loaded, singleton pattern)
 * The model is loaded once and cached for subsequent calls
 */
async function loadModel(): Promise<BlazeFaceModel> {
  // Return cached model if already loaded
  if (model) {
    return model
  }

  // Return existing loading promise if already loading
  if (loadingPromise) {
    return loadingPromise
  }

  // Dynamically import to avoid adding to main bundle
  // Start loading the model
  loadingPromise = (async () => {
    // First, import TensorFlow.js and initialize backend
    const tf = await import('@tensorflow/tfjs')
    
    // Register WebGL backend (best performance) or fallback to CPU
    if (!tf.getBackend()) {
      try {
        await tf.setBackend('webgl')
        await tf.ready()
      } catch {
        await tf.setBackend('cpu')
        await tf.ready()
      }
    }
    
    // Now import and load BlazeFace model
    const blazeface = await import('@tensorflow-models/blazeface')
    const loadedModel = await blazeface.load()
    return loadedModel
  })()
  
  try {
    model = await loadingPromise
    return model
  } catch (error) {
    // Reset loading promise on error so we can retry
    loadingPromise = null
    throw error
  }
}

/**
 * Detect faces in an image file
 * 
 * @param file - Image file to detect faces in
 * @returns Object with detection results: { hasFace: boolean, faceCount: number }
 * @throws Error if model fails to load or image cannot be processed
 */
export async function detectFacesInFile(file: File): Promise<{ hasFace: boolean; faceCount: number }> {
  try {
    // Load model (cached after first load)
    const faceModel = await loadModel()

    // Load image into a tensor
    const img = new Image()
    const imgUrl = URL.createObjectURL(file)
    
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(imgUrl)
          resolve()
        }
        img.onerror = () => {
          URL.revokeObjectURL(imgUrl)
          reject(new Error('Failed to load image'))
        }
        img.src = imgUrl
      })

      // BlazeFace's estimateFaces can accept the image element directly
      // It handles tensor conversion internally
      try {
        const predictions = await faceModel.estimateFaces(img, false) // false = return all faces, not just front-facing
        const faceCount = predictions.length
        
        return {
          hasFace: faceCount > 0,
          faceCount
        }
      } catch (detectionError) {
        throw detectionError
      }
    } catch (imageError) {
      throw imageError
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Only allow graceful degradation for model loading failures
    // If detection itself fails, we should block upload (something is wrong)
    if (errorMessage.includes('load') || errorMessage.includes('import') || errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
      return { hasFace: true, faceCount: 0 }
    }
    
    // For actual detection errors, fail (we should know if detection ran)
    throw error
  }
}

/**
 * Simple wrapper that returns boolean for backward compatibility
 * 
 * @param file - Image file to detect faces in
 * @returns true if at least one face is detected, false otherwise
 */
export async function detectFace(file: File): Promise<boolean> {
  const result = await detectFacesInFile(file)
  return result.hasFace
}

/**
 * Detect if image has exactly one face (for selfie validation)
 * 
 * @param file - Image file to detect faces in
 * @returns Object with validation results: { isValid: boolean, faceCount: number, error?: string }
 */
export async function validateSelfieFace(file: File): Promise<{ 
  isValid: boolean
  faceCount: number
  error?: string 
}> {
  const { hasFace, faceCount } = await detectFacesInFile(file)

  if (!hasFace) {
    return {
      isValid: false,
      faceCount: 0,
      error: 'No face detected in the image. Please upload a photo with a clear face.'
    }
  }

  if (faceCount > 1) {
    return {
      isValid: false,
      faceCount,
      error: 'Multiple faces detected in the image. Please upload a photo with only one face.'
    }
  }

  return {
    isValid: true,
    faceCount: faceCount // Use actual faceCount, not hardcoded 1
  }
}

