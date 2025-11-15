/**
 * Time formatting utilities
 * Shared functions for formatting dates and times across server and client
 */

/**
 * Format a date as "time ago" string (server-side)
 * @param date - The date to format
 * @param locale - Optional locale for formatting (defaults to 'en')
 * @returns Formatted string like "5 minutes ago" or "2 hours ago"
 */
export function formatTimeAgo(date: Date | string, locale: string = 'en'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return locale === 'es' ? 'Hace un momento' : 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    if (locale === 'es') {
      return minutes === 1 ? 'Hace 1 minuto' : `Hace ${minutes} minutos`
    }
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    if (locale === 'es') {
      return hours === 1 ? 'Hace 1 hora' : `Hace ${hours} horas`
    }
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    if (locale === 'es') {
      return days === 1 ? 'Hace 1 día' : `Hace ${days} días`
    }
    return days === 1 ? '1 day ago' : `${days} days ago`
  }
}

/**
 * Format a date using Intl.DateTimeFormat (server-side)
 * @param date - The date to format
 * @param locales - Locale(s) for formatting
 * @param options - DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | number | string,
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : typeof date === 'number' ? new Date(date) : date
  return new Intl.DateTimeFormat(locales, options).format(dateObj)
}

