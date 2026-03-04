interface PrismaCodeLike {
  code?: string
}

function isSerializableConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return (error as PrismaCodeLike).code === 'P2034'
}

export async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (!isSerializableConflict(error) || attempt === maxRetries - 1) {
        throw error
      }
    }
  }

  throw new Error('Unreachable: serializable retry loop exhausted unexpectedly')
}
