export interface RequestOptions extends RequestInit {
  retry?: number
  backoffMs?: number
}

export async function httpFetch(input: RequestInfo | URL, init: RequestOptions = {}): Promise<Response> {
  const { retry = 0, backoffMs = 250, ...rest } = init
  let attempt = 0
  while (true) {
    try {
      return await fetch(input, rest)
    } catch (err) {
      if (attempt >= retry) throw err
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)))
      attempt += 1
    }
  }
}

export function createApiClient(baseUrl: string, defaults?: RequestInit) {
  return async function api(path: string, init?: RequestOptions) {
    return httpFetch(new URL(path, baseUrl), { ...defaults, ...init })
  }
}


