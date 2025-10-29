export function formatNumber(n: number, locales?: string | string[], options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locales, options).format(n)
}

export function formatDate(d: Date | number | string, locales?: string | string[], options?: Intl.DateTimeFormatOptions): string {
  const date = d instanceof Date ? d : new Date(d)
  return new Intl.DateTimeFormat(locales, options).format(date)
}


