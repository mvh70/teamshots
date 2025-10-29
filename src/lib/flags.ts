const flags: Record<string, boolean> = Object.create(null)

export function setFlag(name: string, enabled: boolean): void {
  flags[name] = enabled
}

export function isEnabled(name: string): boolean {
  return Boolean(flags[name])
}


