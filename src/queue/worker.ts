/**
 * Queue Worker Entry Point
 *
 * Starts all background workers for processing jobs
 */

import 'dotenv/config'
import { fileURLToPath } from 'url'
import './workers/generateImage' // Import to register the worker
import { initializeQueues } from './index'

async function startWorkers() {
  try {
    console.log('🚀 Starting TeamShotsPro queue workers...')
    
    // Initialize queues
    await initializeQueues()
    
    console.log('✅ All workers started successfully')
    console.log('📊 Workers are now processing jobs...')
    
    // Graceful shutdown: let in-flight jobs finish before exiting
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, draining workers...`)
      try {
        // Import the worker instance to close it gracefully
        const { default: worker } = await import('./workers/generateImage')
        await worker.close()
        console.log('✅ Workers drained, exiting.')
      } catch (err) {
        console.error('Error during graceful shutdown:', err)
      }
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    
  } catch (error) {
    console.error('❌ Failed to start workers:', error)
    process.exit(1)
  }
}

// Start workers if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startWorkers()
}

export { startWorkers }
