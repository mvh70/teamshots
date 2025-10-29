import { headers } from 'next/headers'

export async function getRequestHeader(name: string): Promise<string | undefined> {
  const h = await headers()
  return h.get(name) ?? undefined
}

export async function getRequestIp(): Promise<string | undefined> {
  const forwardedFor = await getRequestHeader('x-forwarded-for')
  const realIp = await getRequestHeader('x-real-ip')
  return forwardedFor || realIp
}


