export function getChangedDesktopStepIndices<T extends Record<string, unknown>>(
  previousSettings: T,
  nextSettings: T,
  stepKeys?: string[]
): number[] {
  if (!stepKeys || stepKeys.length === 0) return []

  const changed: number[] = []
  stepKeys.forEach((key, index) => {
    if (JSON.stringify(previousSettings[key]) !== JSON.stringify(nextSettings[key])) {
      changed.push(index)
    }
  })
  return changed
}

export function mergeVisitedStepIndices(
  previous: number[],
  additions: number[]
): number[] {
  if (additions.length === 0) return previous
  return Array.from(new Set([...previous, ...additions]))
}
