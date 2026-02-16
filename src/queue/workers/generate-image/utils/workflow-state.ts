import type { Job } from 'bullmq'

import { Logger } from '@/lib/logger'
import type { V3WorkflowState } from '@/types/workflow'

const MAX_WORKFLOW_STATE_BYTES = 5 * 1024 * 1024

function jsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

function stripBase64Fields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripBase64Fields(item))
  }
  if (!value || typeof value !== 'object') {
    return value
  }

  const input = value as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const [key, fieldValue] of Object.entries(input)) {
    if (key === 'base64' && typeof fieldValue === 'string' && fieldValue.length > 0) {
      continue
    }
    output[key] = stripBase64Fields(fieldValue)
  }
  return output
}

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
    let stateToPersist: V3WorkflowState = nextState
    let stateBytes = jsonByteLength(stateToPersist)

    if (stateBytes > MAX_WORKFLOW_STATE_BYTES) {
      stateToPersist = stripBase64Fields(nextState) as V3WorkflowState
      stateBytes = jsonByteLength(stateToPersist)
    }

    if (stateBytes > MAX_WORKFLOW_STATE_BYTES) {
      Logger.warn('Skipping workflow state persistence: payload exceeds size limit', {
        jobId: job.id,
        stateBytes,
        maxBytes: MAX_WORKFLOW_STATE_BYTES,
      })
      return
    }

    await job.updateData({
      ...data,
      workflowState: stateToPersist
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
