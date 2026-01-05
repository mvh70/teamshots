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
  loadModel().catch(error => {
    console.warn('[Face Detection] Preload failed (will retry on actual use):', error)
  })
}

/**
 * Load the BlazeFace model (lazy-loaded, singleton pattern)
 * The model is loaded once and cached for subsequent calls
 */
async function loadModel(): Promise<BlazeFaceModel> {
  // Return cached model if already loaded
  if (model) {
    console.log('[Face Detection] Using cached model')
    return model
  }

  // Return existing loading promise if already loading
  if (loadingPromise) {
    console.log('[Face Detection] Model already loading, waiting...')
    return loadingPromise
  }

  // Dynamically import to avoid adding to main bundle
  // Start loading the model
  console.log('[Face Detection] Starting model load (first time)')
  loadingPromise = (async () => {
    // First, import TensorFlow.js and initialize backend
    console.log('[Face Detection] Importing TensorFlow.js...')
    const tf = await import('@tensorflow/tfjs')
    
    // Register WebGL backend (best performance) or fallback to CPU
    if (!tf.getBackend()) {
      console.log('[Face Detection] No backend registered, initializing...')
      try {
        await tf.setBackend('webgl')
        await tf.ready()
        console.log('[Face Detection] WebGL backend initialized')
      } catch (webglError) {
        console.warn('[Face Detection] WebGL backend failed, trying CPU:', webglError)
        await tf.setBackend('cpu')
        await tf.ready()
        console.log('[Face Detection] CPU backend initialized')
      }
    } else {
      console.log('[Face Detection] Backend already registered:', tf.getBackend())
    }
    
    // Now import and load BlazeFace model
    console.log('[Face Detection] Importing @tensorflow-models/blazeface...')
    const blazeface = await import('@tensorflow-models/blazeface')
    console.log('[Face Detection] BlazeFace module loaded, calling load()...')
    const loadedModel = await blazeface.load()
    console.log('[Face Detection] Model loaded successfully!')
    return loadedModel
  })()
  
  try {
    model = await loadingPromise
    return model
  } catch (error) {
    console.error('[Face Detection] Model loading failed:', error)
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
  console.log('[Face Detection] Starting detection for file:', file.name, file.size, 'bytes', 'type:', file.type)
  
  // For testing/dev, maintain the filename-based simulation
  /*if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    const fileName = file.name.toLowerCase()
    if (fileName.includes('no-face') || fileName.includes('noface')) {
      return { hasFace: false, faceCount: 0 }
    }
    if (fileName.includes('multiple')) {
      return { hasFace: true, faceCount: 2 }
    }
    // Default to face detected for testing
    return { hasFace: true, faceCount: 1 }
  }*/

  try {
    console.log('[Face Detection] Entering try block...')
    console.log('[Face Detection] Loading BlazeFace model...')
    // Load model (cached after first load)
    const faceModel = await loadModel()
    console.log('[Face Detection] Model loaded successfully, type:', typeof faceModel, 'methods:', Object.keys(faceModel))

    // Load image into a tensor
    const img = new Image()
    const imgUrl = URL.createObjectURL(file)
    console.log('[Face Detection] Created image URL, loading image...')
    
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          console.log('[Face Detection] Image loaded, dimensions:', img.width, 'x', img.height)
          URL.revokeObjectURL(imgUrl)
          resolve()
        }
        img.onerror = () => {
          console.error('[Face Detection] Failed to load image')
          URL.revokeObjectURL(imgUrl)
          reject(new Error('Failed to load image'))
        }
        img.src = imgUrl
      })

      // BlazeFace's estimateFaces can accept the image element directly
      // It handles tensor conversion internally
      console.log('[Face Detection] Image ready, running face detection...')
      console.log('[Face Detection] Image element:', { width: img.width, height: img.height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
      console.log('[Face Detection] estimateFaces method exists:', typeof faceModel.estimateFaces)
      try {
        console.log('[Face Detection] Calling estimateFaces...')
        const predictions = await faceModel.estimateFaces(img, false) // false = return all faces, not just front-facing
        console.log('[Face Detection] estimateFaces returned:', predictions?.length || 0, 'predictions')

        const faceCount = predictions.length
        console.log('[Face Detection] Detection complete. Faces found:', faceCount)
        if (predictions.length > 0) {
          console.log('[Face Detection] Face predictions:', predictions.map(p => ({
            probability: p.probability,
            topLeft: p.topLeft,
            bottomRight: p.bottomRight
          })))
        } else {
          console.log('[Face Detection] No faces detected in image')
        }
        
        return {
          hasFace: faceCount > 0,
          faceCount
        }
      } catch (detectionError) {
        console.error('[Face Detection] Detection error:', detectionError)
        throw detectionError
      }
    } catch (imageError) {
      console.error('[Face Detection] Image loading error:', imageError)
      throw imageError
    }
  } catch (error) {
    // Log the full error details
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[Face Detection] Full error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    })
    
    // Only allow graceful degradation for model loading failures
    // If detection itself fails, we should block upload (something is wrong)
    if (errorMessage.includes('load') || errorMessage.includes('import') || errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
      console.warn('[Face Detection] Model loading/network error, allowing upload (graceful degradation):', errorMessage)
      return { hasFace: true, faceCount: 0 }
    }
    
    // For actual detection errors, fail (we should know if detection ran)
    console.error('[Face Detection] Face detection error, blocking upload:', errorMessage)
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
  console.log('[Face Detection] validateSelfieFace called for:', file.name)
  const { hasFace, faceCount } = await detectFacesInFile(file)
  console.log('[Face Detection] Validation result:', { hasFace, faceCount })

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

