// Type-safe next-intl message keys using domain-specific and shared translations
// Messages are split into:
// - shared.json: Common content across all domains
// - teamshotspro.json: TeamShots domain-specific landing content
// - photoshotspro.json: PhotoShots domain-specific landing content
// See: https://next-intl-docs.vercel.app/docs/getting-started/app-router/typescript

type SharedMessages = typeof import('../../messages/en/shared.json')
type TeamShotsMessages = typeof import('../../messages/en/teamshotspro.json')
type PhotoShotsMessages = typeof import('../../messages/en/photoshotspro.json')

// Merge all possible messages for maximum type coverage and autocomplete
type Messages = SharedMessages & TeamShotsMessages & PhotoShotsMessages

declare global {
  // Extend next-intl's IntlMessages to enable key inference in useTranslations
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}

export {}


