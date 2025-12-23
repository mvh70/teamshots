/**
 * Dynamic Progress Tracking System
 * 
 * Calculates progress based on actual workflow steps being executed,
 * handles parallel operations, retries, and provides accurate real-time progress.
 */

import { Logger } from '@/lib/logger'

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Unique step identifier */
  id: string
  /** Human-readable step name */
  name: string
  /** Relative weight of this step (higher = more time/work) */
  weight: number
  /** Step category for grouping (person, background, composition, etc.) */
  category: 'init' | 'person' | 'background' | 'composition' | 'finalization'
  /** Whether this step can be skipped (optional steps) */
  optional?: boolean
  /** Whether this step can run in parallel with others */
  parallel?: boolean
  /** IDs of steps this one is parallel with */
  parallelWith?: string[]
}

/**
 * Step execution state
 */
export interface StepState {
  /** Step ID */
  id: string
  /** Whether the step has started */
  started: boolean
  /** Whether the step has completed */
  completed: boolean
  /** Whether the step was skipped */
  skipped: boolean
  /** Current retry attempt (0 = first attempt) */
  retryAttempt: number
  /** Timestamp when step started */
  startedAt?: Date
  /** Timestamp when step completed */
  completedAt?: Date
}

/**
 * Progress calculation result
 */
export interface ProgressResult {
  /** Overall progress percentage (0-100) */
  percentage: number
  /** Current step being executed */
  currentStep?: WorkflowStep
  /** Total steps that will be executed (excluding skipped) */
  totalSteps: number
  /** Steps completed so far */
  completedSteps: number
  /** Steps currently in progress */
  inProgressSteps: StepState[]
  /** Whether we're in a retry */
  isRetrying: boolean
  /** Human-readable status message */
  statusMessage: string
}

/**
 * V3 Workflow Steps Definition
 * 
 * Weights are assigned based on relative time/complexity:
 * - Person generation: 30 weight (most complex, with retries)
 * - Background generation: 25 weight (parallel, slightly simpler)
 * - Composition: 30 weight (combining and refining)
 * - Evaluations: 5 weight each (quick validation)
 * - Init/prep: 5 weight (quick setup)
 */
export const V3_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'v3-init',
    name: 'Initializing',
    weight: 5,
    category: 'init'
  },
  {
    id: 'v3-preparing',
    name: 'Preparing assets',
    weight: 5,
    category: 'init'
  },
  // Parallel Block: Person (1a) + Background (1b)
  {
    id: 'v3-generating-person',
    name: 'Generating person',
    weight: 25,
    category: 'person',
    parallel: true,
    parallelWith: ['v3-generating-background']
  },
  {
    id: 'v3-evaluating-person',
    name: 'Evaluating person quality',
    weight: 5,
    category: 'person',
    parallel: true,
    parallelWith: ['v3-evaluating-background']
  },
  {
    id: 'v3-generating-background',
    name: 'Generating background',
    weight: 20,
    category: 'background',
    parallel: true,
    parallelWith: ['v3-generating-person'],
    optional: true // Can be skipped if no background needed
  },
  {
    id: 'v3-evaluating-background',
    name: 'Evaluating background quality',
    weight: 5,
    category: 'background',
    parallel: true,
    parallelWith: ['v3-evaluating-person'],
    optional: true
  },
  // Sequential: Composition (after parallel block)
  {
    id: 'v3-compositing',
    name: 'Compositing final image',
    weight: 25,
    category: 'composition'
  },
  {
    id: 'v3-final-eval',
    name: 'Final quality check',
    weight: 5,
    category: 'finalization'
  },
  {
    id: 'v3-uploading',
    name: 'Uploading result',
    weight: 5,
    category: 'finalization'
  }
]

/**
 * V1 Workflow Steps Definition (legacy)
 */
export const V1_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'v1-init',
    name: 'Initializing',
    weight: 5,
    category: 'init'
  },
  {
    id: 'v1-preprocessing',
    name: 'Preprocessing photo',
    weight: 10,
    category: 'init'
  },
  {
    id: 'v1-prompt-ready',
    name: 'Preparing generation',
    weight: 5,
    category: 'init'
  },
  {
    id: 'v1-generating',
    name: 'Generating image',
    weight: 40,
    category: 'composition'
  },
  {
    id: 'v1-generated',
    name: 'Image generated',
    weight: 5,
    category: 'composition'
  },
  {
    id: 'v1-evaluating',
    name: 'Evaluating quality',
    weight: 10,
    category: 'finalization'
  },
  {
    id: 'v1-approved',
    name: 'Quality approved',
    weight: 5,
    category: 'finalization'
  },
  {
    id: 'v1-uploading',
    name: 'Uploading result',
    weight: 10,
    category: 'finalization'
  }
]

/**
 * Progress Tracker Class
 * 
 * Manages workflow progress tracking with support for:
 * - Dynamic step activation (skip optional steps)
 * - Parallel step execution
 * - Retry tracking
 * - Real-time progress calculation
 */
export class ProgressTracker {
  private steps: Map<string, WorkflowStep>
  private state: Map<string, StepState>
  private workflow: 'v1' | 'v3'
  
  constructor(workflow: 'v1' | 'v3' = 'v3') {
    this.workflow = workflow
    const workflowSteps = workflow === 'v3' ? V3_WORKFLOW_STEPS : V1_WORKFLOW_STEPS
    
    this.steps = new Map(workflowSteps.map(step => [step.id, step]))
    this.state = new Map(
      workflowSteps.map(step => [
        step.id,
        {
          id: step.id,
          started: false,
          completed: false,
          skipped: false,
          retryAttempt: 0
        }
      ])
    )
  }

  /**
   * Mark a step as started
   */
  startStep(stepId: string): void {
    const state = this.state.get(stepId)
    if (!state) {
      Logger.warn('Attempted to start unknown step', { stepId, workflow: this.workflow })
      return
    }

    state.started = true
    state.startedAt = new Date()
    
    Logger.debug('Step started', {
      stepId,
      workflow: this.workflow,
      retryAttempt: state.retryAttempt
    })
  }

  /**
   * Mark a step as completed
   */
  completeStep(stepId: string): void {
    const state = this.state.get(stepId)
    if (!state) {
      Logger.warn('Attempted to complete unknown step', { stepId, workflow: this.workflow })
      return
    }

    state.completed = true
    state.completedAt = new Date()
    
    Logger.debug('Step completed', {
      stepId,
      workflow: this.workflow,
      duration: state.startedAt ? Date.now() - state.startedAt.getTime() : 0
    })
  }

  /**
   * Mark a step as skipped (for optional steps)
   */
  skipStep(stepId: string): void {
    const state = this.state.get(stepId)
    if (!state) {
      Logger.warn('Attempted to skip unknown step', { stepId, workflow: this.workflow })
      return
    }

    const step = this.steps.get(stepId)
    if (step && !step.optional) {
      Logger.warn('Attempted to skip non-optional step', { stepId, workflow: this.workflow })
      return
    }

    state.skipped = true
    Logger.debug('Step skipped', { stepId, workflow: this.workflow })
  }

  /**
   * Record a retry attempt for a step
   */
  retryStep(stepId: string): void {
    const state = this.state.get(stepId)
    if (!state) {
      Logger.warn('Attempted to retry unknown step', { stepId, workflow: this.workflow })
      return
    }

    state.retryAttempt++
    state.completed = false // Reset completed state for retry
    
    Logger.debug('Step retry', {
      stepId,
      workflow: this.workflow,
      attempt: state.retryAttempt
    })
  }

  /**
   * Calculate current progress
   */
  getProgress(): ProgressResult {
    // Get active steps (not skipped)
    const activeSteps = Array.from(this.steps.values()).filter(step => {
      const state = this.state.get(step.id)
      return !state?.skipped
    })

    // Calculate total weight (accounting for parallel steps)
    const totalWeight = this.calculateTotalWeight(activeSteps)

    // Calculate completed weight
    let completedWeight = 0
    let inProgressWeight = 0
    const inProgressSteps: StepState[] = []
    let isRetrying = false

    for (const step of activeSteps) {
      const state = this.state.get(step.id)!
      
      if (state.completed) {
        completedWeight += step.weight
      } else if (state.started) {
        // For in-progress steps, count them as partially complete
        // If parallel, divide the partial credit among parallel steps
        const parallelCount = step.parallelWith ? step.parallelWith.length + 1 : 1
        inProgressWeight += (step.weight / parallelCount) * 0.5 // Give 50% credit for started
        inProgressSteps.push(state)
        
        if (state.retryAttempt > 0) {
          isRetrying = true
        }
      }
    }

    // Calculate percentage (0-100)
    const percentage = Math.min(
      100,
      Math.round(((completedWeight + inProgressWeight) / totalWeight) * 100)
    )

    // Find current step
    const currentStep = inProgressSteps.length > 0
      ? this.steps.get(inProgressSteps[0].id)
      : undefined

    // Count completed steps
    const completedSteps = Array.from(this.state.values()).filter(s => s.completed).length

    // Generate status message
    const statusMessage = this.generateStatusMessage(currentStep, inProgressSteps, isRetrying)

    return {
      percentage,
      currentStep,
      totalSteps: activeSteps.length,
      completedSteps,
      inProgressSteps,
      isRetrying,
      statusMessage
    }
  }

  /**
   * Calculate total weight accounting for parallel steps
   * 
   * Parallel steps share weight rather than adding, since they execute simultaneously
   */
  private calculateTotalWeight(steps: WorkflowStep[]): number {
    const processed = new Set<string>()
    let totalWeight = 0

    for (const step of steps) {
      if (processed.has(step.id)) continue

      if (step.parallel && step.parallelWith) {
        // Find all parallel steps
        const parallelSteps = [step, ...steps.filter(s => step.parallelWith?.includes(s.id))]
        
        // Use the maximum weight among parallel steps (they run simultaneously)
        const maxWeight = Math.max(...parallelSteps.map(s => s.weight))
        totalWeight += maxWeight
        
        // Mark all parallel steps as processed
        parallelSteps.forEach(s => processed.add(s.id))
      } else {
        totalWeight += step.weight
        processed.add(step.id)
      }
    }

    return totalWeight
  }

  /**
   * Generate human-readable status message
   */
  private generateStatusMessage(
    currentStep: WorkflowStep | undefined,
    inProgressSteps: StepState[],
    isRetrying: boolean
  ): string {
    if (!currentStep) {
      return 'Preparing...'
    }

    if (isRetrying) {
      const retryAttempt = Math.max(...inProgressSteps.map(s => s.retryAttempt))
      return `${currentStep.name} (retry #${retryAttempt})...`
    }

    // If multiple parallel steps, show them
    if (inProgressSteps.length > 1) {
      const stepNames = inProgressSteps
        .map(s => this.steps.get(s.id)?.name)
        .filter(Boolean)
        .join(' & ')
      return `${stepNames}...`
    }

    return `${currentStep.name}...`
  }

  /**
   * Get detailed state for debugging
   */
  getDetailedState(): Record<string, unknown> {
    return {
      workflow: this.workflow,
      steps: Array.from(this.steps.values()),
      state: Array.from(this.state.entries()).map(([id, state]) => ({
        ...state,
        step: this.steps.get(id)
      }))
    }
  }

  /**
   * Reset tracker (for testing or reuse)
   */
  reset(): void {
    this.state.forEach(state => {
      state.started = false
      state.completed = false
      state.skipped = false
      state.retryAttempt = 0
      delete state.startedAt
      delete state.completedAt
    })
  }
}

/**
 * Helper to format progress for display
 */
export function formatProgress(
  progress: ProgressResult,
  emoji?: string,
  attemptNumber?: number
): string {
  const prefix = attemptNumber ? `Generation #${attemptNumber}\n` : ''
  const emojiStr = emoji ? `${emoji} ` : ''
  return `${prefix}${progress.percentage}% - ${emojiStr}${progress.statusMessage}`
}

