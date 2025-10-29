export async function jsonFetcher<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`)
  }
  return (await res.json()) as T
}


