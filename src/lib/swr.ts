import { jsonFetcher } from './fetcher'
import type { SWRConfiguration } from 'swr'

/**
 * Default SWR fetcher using our jsonFetcher
 * Provides consistent error handling and retry logic
 */
export const swrFetcher = jsonFetcher

/**
 * Common SWR configuration defaults
 */
export const defaultSwrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 2000,
}

// Re-export useSWR and mutate for convenience
export { default as useSWR } from 'swr'
export { mutate } from 'swr'
