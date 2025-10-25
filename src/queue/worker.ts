/**
 * Queue Worker Entry Point
 * 
 * Starts all background workers for processing jobs
 */

import './workers/generateImage' // Import to register the worker
import { initializeQueues } from './index'

async function startWorkers() {
  try {
    console.log('🚀 Starting TeamShots queue workers...')
    
    // Initialize queues
    await initializeQueues()
    
    console.log('✅ All workers started successfully')
    console.log('📊 Workers are now processing jobs...')
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down workers...')
      process.exit(0)
    })
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down workers...')
      process.exit(0)
    })
    
  } catch (error) {
    console.error('❌ Failed to start workers:', error)
    process.exit(1)
  }
}

// Start workers if this file is run directly
if (require.main === module) {
  startWorkers()
}

export { startWorkers }
