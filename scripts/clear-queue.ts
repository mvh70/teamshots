/**
 * Clear Queue Script
 * 
 * Clears jobs from the image generation queue (and optionally all queues)
 * 
 * Usage:
 *   tsx scripts/clear-queue.ts              # Clear only image generation queue (non-destructive)
 *   tsx scripts/clear-queue.ts --force      # Obliterate image generation queue (removes all jobs including completed/failed)
 *   tsx scripts/clear-queue.ts --all       # Clear all queues (non-destructive)
 *   tsx scripts/clear-queue.ts --all --force # Obliterate all queues
 */

import { imageGenerationQueue, backgroundRemovalQueue, emailSendingQueue } from '../src/queue/index.js'

async function clearQueue() {
  try {
    const args = process.argv.slice(2)
    const force = args.includes('--force')
    const all = args.includes('--all')

    console.log('\n=== Clearing Queue ===\n')
    console.log(`Mode: ${force ? 'OBLITERATE (destructive)' : 'REMOVE (non-destructive)'}`)
    console.log(`Scope: ${all ? 'ALL queues' : 'Image generation queue only'}\n`)

    if (all) {
      // Clear all queues
      if (force) {
        await Promise.all([
          imageGenerationQueue.obliterate({ force: true }),
          backgroundRemovalQueue.obliterate({ force: true }),
          emailSendingQueue.obliterate({ force: true }),
        ])
        console.log('✅ All queues obliterated (all jobs removed including completed/failed)')
      } else {
        // Remove waiting/delayed/active jobs from all queues
        const queues = [
          { name: 'Image Generation', queue: imageGenerationQueue },
          { name: 'Background Removal', queue: backgroundRemovalQueue },
          { name: 'Email Sending', queue: emailSendingQueue },
        ]

        for (const { name, queue } of queues) {
          const waiting = await queue.getWaiting()
          const delayed = await queue.getDelayed()
          const active = await queue.getActive()

          // Remove waiting and delayed jobs (these are not locked)
          const waitingResults = await Promise.allSettled(
            waiting.map(job => job.remove())
          )
          const delayedResults = await Promise.allSettled(
            delayed.map(job => job.remove())
          )
          
          // For active jobs, handle locked jobs gracefully
          const activeResults = await Promise.allSettled(
            active.map(async (job) => {
              try {
                await job.remove()
              } catch (error: unknown) {
                // If job is locked, try to fail it first, then remove
                const errorMessage = error instanceof Error ? error.message : String(error)
                if (errorMessage?.includes('locked')) {
                  try {
                    await job.moveToFailed(new Error('Manually cancelled'), '0')
                    await job.remove()
                  } catch (failError) {
                    // If we can't fail it either, skip it
                    throw new Error(`Job ${job.id} is locked and cannot be removed`)
                  }
                } else {
                  throw error
                }
              }
            })
          )

          const waitingRemoved = waitingResults.filter(r => r.status === 'fulfilled').length
          const delayedRemoved = delayedResults.filter(r => r.status === 'fulfilled').length
          const activeRemoved = activeResults.filter(r => r.status === 'fulfilled').length
          const activeLocked = activeResults.filter(r => r.status === 'rejected').length

          const total = waiting.length + delayed.length + active.length
          if (total > 0) {
            let message = `✅ ${name}: Removed ${waitingRemoved}/${waiting.length} waiting, ${delayedRemoved}/${delayed.length} delayed`
            if (active.length > 0) {
              message += `, ${activeRemoved}/${active.length} active`
              if (activeLocked > 0) {
                message += ` (${activeLocked} locked - use --force to obliterate)`
              }
            }
            console.log(message)
          } else {
            console.log(`  ${name}: No jobs to remove`)
          }
        }
      }
    } else {
      // Clear only image generation queue
      if (force) {
        await imageGenerationQueue.obliterate({ force: true })
        console.log('✅ Image generation queue obliterated (all jobs removed including completed/failed)')
      } else {
        const waiting = await imageGenerationQueue.getWaiting()
        const delayed = await imageGenerationQueue.getDelayed()
        const active = await imageGenerationQueue.getActive()

        // Remove waiting and delayed jobs (these are not locked)
        const waitingResults = await Promise.allSettled(
          waiting.map(job => job.remove())
        )
        const delayedResults = await Promise.allSettled(
          delayed.map(job => job.remove())
        )
        
        // For active jobs, handle locked jobs gracefully
        const activeResults = await Promise.allSettled(
          active.map(async (job) => {
            try {
              await job.remove()
            } catch (error: unknown) {
              // If job is locked, try to fail it first, then remove
              const errorMessage = error instanceof Error ? error.message : String(error)
              if (errorMessage?.includes('locked')) {
                try {
                  await job.moveToFailed(new Error('Manually cancelled'), '0')
                  await job.remove()
                } catch (failError) {
                  // If we can't fail it either, skip it
                  throw new Error(`Job ${job.id} is locked and cannot be removed`)
                }
              } else {
                throw error
              }
            }
          })
        )

        const waitingRemoved = waitingResults.filter(r => r.status === 'fulfilled').length
        const delayedRemoved = delayedResults.filter(r => r.status === 'fulfilled').length
        const activeRemoved = activeResults.filter(r => r.status === 'fulfilled').length
        const activeLocked = activeResults.filter(r => r.status === 'rejected').length

        const total = waiting.length + delayed.length + active.length
        if (total > 0) {
          let message = `✅ Removed ${waitingRemoved}/${waiting.length} waiting, ${delayedRemoved}/${delayed.length} delayed`
          if (active.length > 0) {
            message += `, ${activeRemoved}/${active.length} active`
            if (activeLocked > 0) {
              message += ` (${activeLocked} locked - use --force to obliterate)`
            }
          }
          console.log(message)
        } else {
          console.log('✅ No jobs to remove')
        }
      }
    }

    // Show final counts
    console.log('\n=== Final Queue Status ===')
    const [imageGenStats, bgRemovalStats, emailStats] = await Promise.all([
      imageGenerationQueue.getJobCounts(),
      backgroundRemovalQueue.getJobCounts(),
      emailSendingQueue.getJobCounts(),
    ])

    console.log(`Image Generation: ${JSON.stringify(imageGenStats)}`)
    console.log(`Background Removal: ${JSON.stringify(bgRemovalStats)}`)
    console.log(`Email Sending: ${JSON.stringify(emailStats)}`)

    console.log('\n=== Done ===\n')
  } catch (error) {
    console.error('❌ Error clearing queue:', error)
    process.exit(1)
  } finally {
    await Promise.all([
      imageGenerationQueue.close(),
      backgroundRemovalQueue.close(),
      emailSendingQueue.close(),
    ])
    process.exit(0)
  }
}

clearQueue()

