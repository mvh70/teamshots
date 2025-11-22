type Level = 'debug' | 'info' | 'warn' | 'error'

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    // Use JSON.stringify with increased space for readability and no length limit
    // Use a replacer to handle circular references and large strings
    try {
      const payload = JSON.stringify(meta, (key, value) => {
        // Handle very long strings by showing first and last parts
        if (typeof value === 'string' && value.length > 10000) {
          return value.substring(0, 5000) + '\n...[truncated ' + (value.length - 10000) + ' chars]...\n' + value.substring(value.length - 5000)
        }
        return value
      }, 2)
      console[level](`[${level.toUpperCase()}] ${message}`)
      console[level](payload)
    } catch {
      // Fallback if JSON.stringify fails (circular reference, etc.)
      console[level](`[${level.toUpperCase()}] ${message}`)
      console[level](meta)
    }
  } else {
    console[level](`[${level.toUpperCase()}] ${message}`)
  }
}

export const Logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
}


