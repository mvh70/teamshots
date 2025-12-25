/**
 * Tests for Dynamic Progress Tracking System
 */

import { ProgressTracker, V3_WORKFLOW_STEPS } from './progress-tracker'

describe('ProgressTracker', () => {
  describe('Basic Sequential Flow', () => {
    it('starts at 0% with no steps completed', () => {
      const tracker = new ProgressTracker('v3')
      const progress = tracker.getProgress()
      
      expect(progress.percentage).toBe(0)
      expect(progress.completedSteps).toBe(0)
      expect(progress.totalSteps).toBe(V3_WORKFLOW_STEPS.length)
    })

    it('shows partial progress when step is started', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-init')
      const progress = tracker.getProgress()
      
      expect(progress.percentage).toBeGreaterThan(0)
      expect(progress.percentage).toBeLessThan(100)
      expect(progress.currentStep?.id).toBe('v3-init')
      expect(progress.statusMessage).toContain('Initializing')
    })

    it('increases progress when step is completed', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-init')
      const progress1 = tracker.getProgress()
      
      tracker.completeStep('v3-init')
      const progress2 = tracker.getProgress()
      
      expect(progress2.percentage).toBeGreaterThan(progress1.percentage)
      expect(progress2.completedSteps).toBe(1)
    })

    it('progresses through multiple sequential steps', () => {
      const tracker = new ProgressTracker('v3')
      
      // Complete init and preparing
      tracker.startStep('v3-init')
      tracker.completeStep('v3-init')
      
      tracker.startStep('v3-preparing')
      tracker.completeStep('v3-preparing')
      
      const progress = tracker.getProgress()
      
      expect(progress.completedSteps).toBe(2)
      expect(progress.percentage).toBeGreaterThan(0)
      expect(progress.percentage).toBeLessThan(100)
    })

    it('reaches 100% when all steps complete', () => {
      const tracker = new ProgressTracker('v3')
      
      // Complete all steps
      V3_WORKFLOW_STEPS.forEach(step => {
        tracker.startStep(step.id)
        tracker.completeStep(step.id)
      })
      
      const progress = tracker.getProgress()
      
      expect(progress.percentage).toBe(100)
      expect(progress.completedSteps).toBe(V3_WORKFLOW_STEPS.length)
    })
  })

  describe('Parallel Step Handling', () => {
    it('shows both parallel steps in progress', () => {
      const tracker = new ProgressTracker('v3')
      
      // Complete init steps
      tracker.startStep('v3-init')
      tracker.completeStep('v3-init')
      tracker.startStep('v3-preparing')
      tracker.completeStep('v3-preparing')
      
      // Start parallel steps
      tracker.startStep('v3-generating-person')
      tracker.startStep('v3-generating-background')
      
      const progress = tracker.getProgress()
      
      expect(progress.inProgressSteps).toHaveLength(2)
      expect(progress.statusMessage).toContain('&')
      expect(progress.statusMessage).toContain('Generating person')
      expect(progress.statusMessage).toContain('Generating background')
    })

    it('calculates progress correctly for parallel steps', () => {
      const tracker = new ProgressTracker('v3')
      
      // Complete init
      tracker.startStep('v3-init')
      tracker.completeStep('v3-init')
      tracker.startStep('v3-preparing')
      tracker.completeStep('v3-preparing')
      
      const progressBefore = tracker.getProgress()
      
      // Start and complete parallel steps
      tracker.startStep('v3-generating-person')
      tracker.startStep('v3-generating-background')
      tracker.completeStep('v3-generating-person')
      tracker.completeStep('v3-generating-background')
      
      const progressAfter = tracker.getProgress()
      
      // Progress should increase significantly (parallel steps have high weight)
      expect(progressAfter.percentage).toBeGreaterThan(progressBefore.percentage + 20)
    })

    it('handles parallel evaluation steps', () => {
      const tracker = new ProgressTracker('v3')
      
      // Get to evaluation phase
      tracker.startStep('v3-init')
      tracker.completeStep('v3-init')
      tracker.startStep('v3-preparing')
      tracker.completeStep('v3-preparing')
      tracker.startStep('v3-generating-person')
      tracker.completeStep('v3-generating-person')
      tracker.startStep('v3-generating-background')
      tracker.completeStep('v3-generating-background')
      
      // Start parallel evaluations
      tracker.startStep('v3-evaluating-person')
      tracker.startStep('v3-evaluating-background')
      
      const progress = tracker.getProgress()
      
      expect(progress.inProgressSteps).toHaveLength(2)
      expect(progress.statusMessage).toContain('Evaluating')
    })
  })

  describe('Optional Step Skipping', () => {
    it('reduces total steps when optional step is skipped', () => {
      const tracker = new ProgressTracker('v3')
      
      const progressBefore = tracker.getProgress()
      
      // Skip background steps (optional)
      tracker.skipStep('v3-generating-background')
      tracker.skipStep('v3-evaluating-background')
      
      const progressAfter = tracker.getProgress()
      
      expect(progressAfter.totalSteps).toBe(progressBefore.totalSteps - 2)
    })

    it('calculates higher progress per step when optional steps are skipped', () => {
      const tracker = new ProgressTracker('v3')
      
      // Skip background
      tracker.skipStep('v3-generating-background')
      tracker.skipStep('v3-evaluating-background')
      
      // Complete first step
      tracker.startStep('v3-init')
      tracker.completeStep('v3-init')
      
      const progress = tracker.getProgress()
      
      // Should have more progress per step since total work is less
      expect(progress.percentage).toBeGreaterThan(5) // More than with all steps
    })

    it('prevents skipping non-optional steps', () => {
      const tracker = new ProgressTracker('v3')
      
      // Try to skip required step (should log warning but not crash)
      tracker.skipStep('v3-compositing')
      
      const progress = tracker.getProgress()
      
      // Total steps should not change
      expect(progress.totalSteps).toBe(V3_WORKFLOW_STEPS.length)
    })

    it('handles workflow with no background generation', () => {
      const tracker = new ProgressTracker('v3')
      
      // Skip background
      tracker.skipStep('v3-generating-background')
      tracker.skipStep('v3-evaluating-background')
      
      // Complete person-only workflow
      tracker.startStep('v3-init')
      tracker.completeStep('v3-init')
      tracker.startStep('v3-preparing')
      tracker.completeStep('v3-preparing')
      tracker.startStep('v3-generating-person')
      tracker.completeStep('v3-generating-person')
      tracker.startStep('v3-evaluating-person')
      tracker.completeStep('v3-evaluating-person')
      tracker.startStep('v3-compositing')
      tracker.completeStep('v3-compositing')
      tracker.startStep('v3-final-eval')
      tracker.completeStep('v3-final-eval')
      tracker.startStep('v3-uploading')
      tracker.completeStep('v3-uploading')
      
      const progress = tracker.getProgress()
      
      expect(progress.percentage).toBe(100)
      expect(progress.completedSteps).toBe(7) // 9 total - 2 skipped
    })
  })

  describe('Retry Tracking', () => {
    it('tracks retry attempts', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-generating-person')
      tracker.retryStep('v3-generating-person')
      
      const state = tracker.getDetailedState()
      const personState = (state.state as Array<{ id: string; retryAttempt: number }>)
        .find(s => s.id === 'v3-generating-person')
      
      expect(personState?.retryAttempt).toBe(1)
    })

    it('shows retry count in status message', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-generating-person')
      tracker.retryStep('v3-generating-person')
      
      const progress = tracker.getProgress()
      
      expect(progress.isRetrying).toBe(true)
      expect(progress.statusMessage).toContain('retry')
      expect(progress.statusMessage).toContain('#1')
    })

    it('handles multiple retry attempts', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-generating-person')
      tracker.retryStep('v3-generating-person')
      tracker.retryStep('v3-generating-person')
      tracker.retryStep('v3-generating-person')
      
      const progress = tracker.getProgress()
      const state = tracker.getDetailedState()
      const personState = (state.state as Array<{ id: string; retryAttempt: number }>)
        .find(s => s.id === 'v3-generating-person')
      
      expect(personState?.retryAttempt).toBe(3)
      expect(progress.statusMessage).toContain('#3')
    })

    it('resets completed state on retry', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-generating-person')
      tracker.completeStep('v3-generating-person')
      
      const progress1 = tracker.getProgress()
      expect(progress1.completedSteps).toBe(1)
      
      // Retry (should reset completed state)
      tracker.retryStep('v3-generating-person')
      
      const progress2 = tracker.getProgress()
      expect(progress2.completedSteps).toBe(0)
    })
  })


  describe('Status Messages', () => {
    it('shows step name in status', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-compositing')
      const progress = tracker.getProgress()
      
      expect(progress.statusMessage).toBe('Compositing final image...')
    })

    it('shows preparing when no steps started', () => {
      const tracker = new ProgressTracker('v3')
      const progress = tracker.getProgress()
      
      expect(progress.statusMessage).toBe('Preparing...')
    })

    it('shows parallel steps joined with &', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-generating-person')
      tracker.startStep('v3-generating-background')
      
      const progress = tracker.getProgress()
      
      expect(progress.statusMessage).toMatch(/.*&.*/)
    })
  })

  describe('Edge Cases', () => {
    it('handles unknown step IDs gracefully', () => {
      const tracker = new ProgressTracker('v3')
      
      // Should not crash
      expect(() => tracker.startStep('unknown-step')).not.toThrow()
      expect(() => tracker.completeStep('unknown-step')).not.toThrow()
      expect(() => tracker.skipStep('unknown-step')).not.toThrow()
    })

    it('handles completing a step before starting it', () => {
      const tracker = new ProgressTracker('v3')
      
      // Should not crash
      expect(() => tracker.completeStep('v3-init')).not.toThrow()
      
      const progress = tracker.getProgress()
      expect(progress.completedSteps).toBe(1)
    })

    it('handles starting a step twice', () => {
      const tracker = new ProgressTracker('v3')
      
      tracker.startStep('v3-init')
      tracker.startStep('v3-init') // Second start
      
      const progress = tracker.getProgress()
      
      // Should still show as one step in progress
      expect(progress.inProgressSteps).toHaveLength(1)
    })

    it('can be reset and reused', () => {
      const tracker = new ProgressTracker('v3')
      
      // Complete some steps
      tracker.startStep('v3-init')
      tracker.completeStep('v3-init')
      
      const progress1 = tracker.getProgress()
      expect(progress1.completedSteps).toBe(1)
      
      // Reset
      tracker.reset()
      
      const progress2 = tracker.getProgress()
      expect(progress2.completedSteps).toBe(0)
      expect(progress2.percentage).toBe(0)
    })
  })

  describe('Progress Calculation Accuracy', () => {
    it('never exceeds 100%', () => {
      const tracker = new ProgressTracker('v3')
      
      // Complete all steps multiple times (shouldn't matter)
      V3_WORKFLOW_STEPS.forEach(step => {
        tracker.startStep(step.id)
        tracker.completeStep(step.id)
        tracker.completeStep(step.id) // Complete twice
      })
      
      const progress = tracker.getProgress()
      expect(progress.percentage).toBe(100)
    })

    it('never goes backwards', () => {
      const tracker = new ProgressTracker('v3')
      let lastPercentage = 0
      
      // Complete steps one by one
      for (const step of V3_WORKFLOW_STEPS) {
        tracker.startStep(step.id)
        tracker.completeStep(step.id)
        
        const progress = tracker.getProgress()
        expect(progress.percentage).toBeGreaterThanOrEqual(lastPercentage)
        lastPercentage = progress.percentage
      }
    })

    it('distributes progress fairly across equal-weight steps', () => {
      const tracker = new ProgressTracker('v3')
      
      const progressPerStep: number[] = []
      
      for (const step of V3_WORKFLOW_STEPS) {
        tracker.startStep(step.id)
        tracker.completeStep(step.id)
        progressPerStep.push(tracker.getProgress().percentage)
      }
      
      // Progress should increase consistently
      for (let i = 1; i < progressPerStep.length; i++) {
        expect(progressPerStep[i]).toBeGreaterThan(progressPerStep[i - 1])
      }
    })
  })
})

