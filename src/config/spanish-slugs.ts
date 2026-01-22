/**
 * Spanish slug mappings for localized URLs
 * Maps Spanish slugs to their English canonical equivalents
 */

// Solutions/Verticals: Spanish slug -> English slug
export const SPANISH_SOLUTION_SLUGS: Record<string, string> = {
  'inmobiliario': 'real-estate',
  'medico': 'medical',
  'abogados': 'law-firms',
  'servicios-financieros': 'financial-services',
  'contratando': 'actively-hiring',
  'consultoria': 'consulting',
  'contabilidad': 'accounting',
};

// Reverse mapping: English slug -> Spanish slug
export const ENGLISH_TO_SPANISH_SOLUTION_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(SPANISH_SOLUTION_SLUGS).map(([es, en]) => [en, es])
);

// Blog: Spanish slug -> English slug
export const SPANISH_BLOG_SLUGS: Record<string, string> = {
  'ia-fotos-perfil-resena-2025': 'ai-headshots-review-2025',
  'costo-promedio-fotos-profesionales': 'average-cost-professional-headshots',
  'guia-fotos-profesionales-equipos': 'professional-headshots-teams-guide',
};

// Reverse mapping: English slug -> Spanish slug
export const ENGLISH_TO_SPANISH_BLOG_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(SPANISH_BLOG_SLUGS).map(([es, en]) => [en, es])
);

/**
 * Get English slug from Spanish slug for solutions
 */
export function getEnglishSolutionSlug(spanishSlug: string): string | undefined {
  return SPANISH_SOLUTION_SLUGS[spanishSlug];
}

/**
 * Get Spanish slug from English slug for solutions
 */
export function getSpanishSolutionSlug(englishSlug: string): string | undefined {
  return ENGLISH_TO_SPANISH_SOLUTION_SLUGS[englishSlug];
}

/**
 * Get English slug from Spanish slug for blog
 */
export function getEnglishBlogSlug(spanishSlug: string): string | undefined {
  return SPANISH_BLOG_SLUGS[spanishSlug];
}

/**
 * Get Spanish slug from English slug for blog
 */
export function getSpanishBlogSlug(englishSlug: string): string | undefined {
  return ENGLISH_TO_SPANISH_BLOG_SLUGS[englishSlug];
}
