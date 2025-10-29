import { unstable_cache as nextCache, revalidatePath } from 'next/cache'

export function cached<TArgs extends unknown[], TResult>(
  key: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options?: { revalidate?: number }
) {
  return nextCache(fn, [key], { revalidate: options?.revalidate })
}

export function revalidate(route: string): void {
  revalidatePath(route)
}


