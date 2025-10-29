type Reader<T> = (raw: string) => T

const asString: Reader<string> = (raw) => raw
const asNumber: Reader<number> = (raw) => Number(raw)
const asBoolean: Reader<boolean> = (raw) => raw === 'true' || raw === '1'

export function readEnv<T = string>(name: string, reader: Reader<T> = asString as unknown as Reader<T>, fallback?: T): T {
  const raw = process.env[name]
  if (raw == null) {
    if (fallback !== undefined) return fallback
    throw new Error(`Missing environment variable: ${name}`)
  }
  return reader(raw)
}

export const Env = {
  string: (name: string, fallback?: string) => readEnv(name, asString, fallback),
  number: (name: string, fallback?: number) => readEnv(name, asNumber, fallback),
  boolean: (name: string, fallback?: boolean) => readEnv(name, asBoolean, fallback),
}


