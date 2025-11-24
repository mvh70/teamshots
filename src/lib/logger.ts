type Level = 'debug' | 'info' | 'warn' | 'error'

// ANSI escape codes for terminal formatting
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  // Check if this is a step log (V2 Step X:)
  const isStepLog = message.includes('V2 Step') && message.includes(':')
  
  // Format the message with bold for step logs
  const formattedMessage = isStepLog 
    ? `${BOLD}[${level.toUpperCase()}] ${message}${RESET}`
    : `[${level.toUpperCase()}] ${message}`
  
  if (meta) {
    // Check if there's a prompt field that should be formatted with real line breaks
    const hasPrompt = meta.prompt && typeof meta.prompt === 'string'
    
    if (hasPrompt) {
      // Log the message
      console[level](formattedMessage)
      
      // Log prompt with real line breaks (replace escaped \n with actual newlines)
      const promptValue = meta.prompt as string
      console[level]('Prompt:')
      console[level](promptValue.replace(/\\n/g, '\n'))
      
      // Log other meta fields if any
      const otherMeta = { ...meta }
      delete otherMeta.prompt
      if (Object.keys(otherMeta).length > 0) {
        try {
          const payload = JSON.stringify(otherMeta, (key, value) => {
            // Handle very long strings by showing first and last parts
            if (typeof value === 'string' && value.length > 10000) {
              return value.substring(0, 5000) + '\n...[truncated ' + (value.length - 10000) + ' chars]...\n' + value.substring(value.length - 5000)
            }
            return value
          }, 2)
          console[level](payload)
        } catch {
          console[level](otherMeta)
        }
      }
    } else {
      // No prompt field, use standard JSON logging
      try {
        const payload = JSON.stringify(meta, (key, value) => {
          // Handle very long strings by showing first and last parts
          if (typeof value === 'string' && value.length > 10000) {
            return value.substring(0, 5000) + '\n...[truncated ' + (value.length - 10000) + ' chars]...\n' + value.substring(value.length - 5000)
          }
          return value
        }, 2)
        console[level](formattedMessage)
        console[level](payload)
      } catch {
        // Fallback if JSON.stringify fails (circular reference, etc.)
        console[level](formattedMessage)
        console[level](meta)
      }
    }
  } else {
    console[level](formattedMessage)
  }
}

export const Logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
}


