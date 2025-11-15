export interface RequestOptions extends RequestInit {
  retry?: number
  backoffMs?: number
}

/**
 * Enhanced JSON fetcher with optional retry logic
 * Consolidates jsonFetcher and httpFetch functionality
 */
export async function jsonFetcher<T>(
  input: RequestInfo | URL,
  init?: RequestOptions
): Promise<T> {
  const { retry = 0, backoffMs = 250, ...rest } = init || {}
  let attempt = 0

  while (true) {
    try {
      const res = await fetch(input, rest)
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }
      return (await res.json()) as T
    } catch (err) {
      if (attempt >= retry) throw err
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)))
      attempt += 1
    }
  }
}


