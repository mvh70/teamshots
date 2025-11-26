import type { Job } from 'bullmq'

import type { V3WorkflowState } from '@/types/workflow'

export function getWorkflowState(job: Job): V3WorkflowState | undefined {
  const data = job.data as { workflowState?: V3WorkflowState }
  return data.workflowState
}

export async function setWorkflowState(
  job: Job,
  nextState: V3WorkflowState | undefined
): Promise<void> {
  const data = job.data as Record<string, unknown>

  if (nextState) {
    await job.updateData({
      ...data,
      workflowState: nextState
    })
    return
  }

  if (!data.workflowState) {
    return
  }

  const { workflowState: _, ...rest } = data
  void _ // Intentionally unused - destructuring to remove from job data
  await job.updateData(rest)
}

