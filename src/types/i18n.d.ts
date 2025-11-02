// Type-safe next-intl message keys using the default English messages as source of truth
// See: https://next-intl-docs.vercel.app/docs/getting-started/app-router/typescript

type Messages = typeof import('../../messages/en.json')

declare global {
  // Extend next-intl's IntlMessages to enable key inference in useTranslations
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}

export {}


