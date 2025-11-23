/**
 * Simple test to verify both Gemini clients can be imported and initialized
 */

async function testGeminiClients() {
  console.log('Testing Gemini client imports...')

  try {
    // Test Vertex AI client import
    const { generateWithGemini } = await import('./src/queue/workers/generate-image/gemini.ts')
    console.log('✅ Vertex AI client imported successfully')

    // Test REST API client import
    const { generateWithGeminiRest } = await import('./src/queue/workers/generate-image/gemini-rest.ts')
    console.log('✅ REST API client imported successfully')

    console.log('✅ All Gemini clients imported successfully!')
    console.log('')
    console.log('To use REST API client, set GOOGLE_CLOUD_API_KEY in your environment.')
    console.log('To use Vertex AI client, set GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_PROJECT_ID.')
    console.log('The system will automatically choose the appropriate client based on available credentials.')

  } catch (error) {
    console.error('❌ Error importing Gemini clients:', error.message)
    process.exit(1)
  }
}

testGeminiClients()
