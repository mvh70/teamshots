/**
 * Queue Worker Entry Point
 *
 * Starts all background workers for processing jobs
 */

import 'dotenv/config'
import { fileURLToPath } from 'url'
import './workers/generateImage' // Import to register the worker
import { initializeQueues } from './index'
import { destroyGenerateImageResources } from './workers/generateImage'

function installPipeErrorHandlers() {
  const handlePipeError = (error: NodeJS.ErrnoException) => {
    if (error?.code === 'EPIPE') {
      // Output pipe closed (for example, interrupted/terminated terminal output).
      // Exit cleanly instead of crashing with unhandled socket error.
      process.exit(0)
    }
  }

  process.stdout.on('error', handlePipeError)
  process.stderr.on('error', handlePipeError)
}

async function startWorkers() {
  installPipeErrorHandlers()

  try {
    console.log('🚀 Starting TeamShotsPro queue workers...')
    
    // Initialize queues
    await initializeQueues()
    
    console.log('✅ All workers started successfully')
    console.log('📊 Workers are now processing jobs...')
    
    // Graceful shutdown: let in-flight jobs finish before exiting
    let shuttingDown = false
    const shutdown = async (signal: string) => {
      if (shuttingDown) return
      shuttingDown = true

      console.log(`\n🛑 Received ${signal}, draining workers...`)
      try {
        // Import the worker instance to close it gracefully
        const { default: worker } = await import('./workers/generateImage')
        await worker.close()
        destroyGenerateImageResources()
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
