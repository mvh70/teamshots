import enMessages from '../../messages/en/shared.json'
import esMessages from '../../messages/es/shared.json'

type Messages = typeof enMessages

const messages: Record<string, Messages> = {
  en: enMessages,
  es: esMessages,
}

export function getTranslation(key: string, locale: 'en' | 'es' = 'en', params?: Record<string, string>): string {
  const keys = key.split('.')
  let value: unknown = messages[locale]
  
  for (const k of keys) {
    value = (value as Record<string, unknown>)?.[k]
  }
  
  if (typeof value !== 'string') {
    // Fallback to English if translation not found
    value = messages.en
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k]
    }
  }
  
  if (typeof value !== 'string') {
    return key // Return the key if no translation found
  }
  
  // Replace parameters in the translation (replace all occurrences)
  if (params) {
    for (const [param, replacement] of Object.entries(params)) {
      const regex = new RegExp(`\\{${param}\\}`, 'g')
      value = (value as string).replace(regex, replacement)
    }
  }
  
  return value as string
}

export function getEmailTranslation(key: string, locale: 'en' | 'es' = 'en', params?: Record<string, string>): string {
  return getTranslation(`emails.${key}`, locale, params)
}
