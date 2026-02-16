import { Logger } from '@/lib/logger'

const UNION_ARRAY_PATHS = new Set([
  'subject.wardrobe.color_palette',
  'subject.wardrobe.inherent_accessories',
])

const CONCAT_ARRAY_PATHS = new Set(['rendering.effects'])

export interface DeepMergeDebug {
  conflictPaths: string[]
  unlistedArrayPaths: string[]
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T
  }
  if (value && typeof value === 'object') {
    const cloned: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      cloned[key] = deepClone(child)
    }
    return cloned as T
  }
  return value
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mergeArray(
  path: string,
  target: unknown[],
  source: unknown[],
  debug: DeepMergeDebug
): unknown[] {
  if (UNION_ARRAY_PATHS.has(path)) {
    const seen = new Set<string>()
    const merged: unknown[] = []
    for (const item of [...target, ...source]) {
      const key = typeof item === 'string' ? `str:${item}` : JSON.stringify(item)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
    return merged
  }

  if (CONCAT_ARRAY_PATHS.has(path)) {
    return [...target, ...source]
  }

  debug.unlistedArrayPaths.push(path)
  return deepClone(source)
}

function mergeRecursive(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  pathPrefix: string,
  debug: DeepMergeDebug
): void {
  for (const [key, sourceValue] of Object.entries(source)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key
    const targetValue = target[key]

    if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      target[key] = mergeArray(path, targetValue, sourceValue, debug)
      continue
    }

    if (isObject(sourceValue) && isObject(targetValue)) {
      mergeRecursive(targetValue, sourceValue, path, debug)
      continue
    }

    if (
      key in target &&
      typeof targetValue !== 'undefined' &&
      typeof sourceValue !== 'undefined' &&
      JSON.stringify(targetValue) !== JSON.stringify(sourceValue)
    ) {
      debug.conflictPaths.push(path)
    }

    target[key] = deepClone(sourceValue)
  }
}

export function deepMergePromptObjects(
  base: Record<string, unknown>,
  overlay?: Record<string, unknown>
): { merged: Record<string, unknown>; debug: DeepMergeDebug } {
  const merged = deepClone(base)
  const debug: DeepMergeDebug = {
    conflictPaths: [],
    unlistedArrayPaths: [],
  }

  if (overlay) {
    mergeRecursive(merged, overlay, '', debug)
  }

  if (debug.unlistedArrayPaths.length > 0) {
    Logger.warn('Prompt deep merge encountered unlisted array path(s)', {
      paths: Array.from(new Set(debug.unlistedArrayPaths)),
    })
  }

  return { merged, debug }
}

export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>()

  const sortObject = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map((item) => sortObject(item))
    }

    if (input && typeof input === 'object') {
      if (seen.has(input as object)) {
        return '[Circular]'
      }
      seen.add(input as object)

      const output: Record<string, unknown> = {}
      const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
      )
      for (const [key, child] of entries) {
        output[key] = sortObject(child)
      }
      return output
    }

    return input
  }

  return JSON.stringify(sortObject(value))
}
