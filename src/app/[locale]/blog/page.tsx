import type { Metadata } from 'next';
import Link from 'next/link';
import { routing } from '@/i18n/routing';

type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  category: string;
};

const enPosts: Post[] = [
  {
    slug: 'ai-headshots-for-linkedin',
    title: 'AI Headshots for LinkedIn: Do They Work in 2025? (Recruiter Tested)',
    description: 'Explore AI headshots for LinkedIn in 2025. Research shows recruiters can\'t tell the difference (87% couldn\'t identify them). Tips for professional ai headshots.',
    date: '2025-11-28',
    readTime: '10 min read',
    category: 'LinkedIn',
  },
  {
    slug: 'free-vs-paid-ai-headshots',
    title: 'Free vs Paid AI Headshot Generators 2025: Honest Comparison',
    description: 'Compare free AI headshot generators vs paid in 2025. See real examples, quality differences, and when to upgrade.',
    date: '2025-11-28',
    readTime: '9 min read',
    category: 'Comparisons',
  },
  {
    slug: 'corporate-ai-headshots',
    title: 'Corporate AI Headshots: 2025 Guide for Remote Teams & HR',
    description: 'Complete guide to corporate AI headshots in 2025. Save 80-90% vs photographers with consistent, professional results.',
    date: '2025-11-28',
    readTime: '11 min read',
    category: 'Teams',
  },
  {
    slug: 'best-ai-headshot-generators',
    title: 'Best AI Headshot Generators in 2025 (Compared & Reviewed)',
    description: 'Discover the best AI headshot generators for 2025. Compare quality, speed, and price for professional ai headshots.',
    date: '2025-11-28',
    readTime: '8 min read',
    category: 'Comparisons',
  },
  {
    slug: 'free-ai-headshot-generator',
    title: 'Best Free AI Headshot Generator 2025: Realistic Results Without Paying',
    description: 'Discover the best free AI headshot generator for 2025. Create professional ai headshots from selfies without watermarks.',
    date: '2025-11-28',
    readTime: '7 min read',
    category: 'Guides',
  },
  {
    slug: 'professional-headshots-ai',
    title: 'Professional Headshots AI: Create Studio-Quality Photos in 2025',
    description: 'Generate professional headshots AI in 2025 with realistic results. Compare top tools for business, LinkedIn, and team use.',
    date: '2025-11-28',
    readTime: '9 min read',
    category: 'Guides',
  },
  {
    slug: 'headshot-ai-generator',
    title: 'Headshot AI Generator 2025: Create Professional Photos Instantly',
    description: 'Best headshot AI generator for 2025. Generate ai headshots from selfies in seconds. Compare tools for quality and speed.',
    date: '2025-11-28',
    readTime: '8 min read',
    category: 'Guides',
  },
];

const esPosts: Post[] = [
  {
    slug: 'ai-headshots-for-linkedin',
    title: 'Headshots AI para LinkedIn: ¿Funcionan en 2025? (Probados por Reclutadores)',
    description: 'Explora headshots AI para LinkedIn en 2025. Los probamos con reclutadores (87% no pudieron distinguir). Consejos para headshots ai profesionales.',
    date: '2025-11-28',
    readTime: '10 min de lectura',
    category: 'LinkedIn',
  },
  {
    slug: 'free-vs-paid-ai-headshots',
    title: 'Comparación Honesta de Generadores de Headshots AI Gratuitos vs Pagados 2025',
    description: 'Compara generadores de headshots AI gratuitos vs pagados en 2025. Vea ejemplos reales, diferencias de calidad y cuándo mejorar.',
    date: '2025-11-28',
    readTime: '9 min de lectura',
    category: 'Comparaciones',
  },
  {
    slug: 'corporate-ai-headshots',
    title: 'Guía Corporativa de Headshots AI: 2025 para Equipos Remotos & RRHH',
    description: 'Guía completa para headshots AI corporativos en 2025. Ahorra el 80-90% en fotógrafos con resultados consistentes y profesionales.',
    date: '2025-11-28',
    readTime: '11 min de lectura',
    category: 'Equipos',
  },
  {
    slug: 'best-ai-headshot-generators',
    title: 'Mejores Generadores de Headshots AI en 2025 (Comparados y Revisados)',
    description: 'Descubre los mejores generadores de headshots AI para 2025. Comparamos calidad, velocidad y precio para headshots ai profesionales.',
    date: '2025-11-28',
    readTime: '8 min de lectura',
    category: 'Comparaciones',
  },
  {
    slug: 'free-ai-headshot-generator',
    title: 'Mejor Generador de Headshots AI Gratuito 2025: Resultados Realistas Sin Pagar',
    description: 'Descubre el mejor generador de headshots AI gratuito para 2025. Crea headshots ai profesionales desde selfies sin marcas de agua.',
    date: '2025-11-28',
    readTime: '7 min de lectura',
    category: 'Guías',
  },
  {
    slug: 'professional-headshots-ai',
    title: 'Headshots AI Profesionales: Crea Fotos de Estudio de Calidad en 2025',
    description: 'Genera headshots AI profesionales en 2025 con resultados realistas. Compara las mejores herramientas para negocios, LinkedIn y uso de equipo.',
    date: '2025-11-28',
    readTime: '9 min de lectura',
    category: 'Guías',
  },
  {
    slug: 'headshot-ai-generator',
    title: 'Generador de Headshots AI 2025: Crea Fotos Profesionales Instantáneamente',
    description: 'El mejor generador de headshots AI para 2025. Genera headshots ai desde selfies en segundos. Compara herramientas para calidad y velocidad.',
    date: '2025-11-28',
    readTime: '8 min de lectura',
    category: 'Guías',
  },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = 'Blog';
  const description = locale === 'es' 
    ? 'Consejos, guías e insights sobre headshots AI, fotos de equipo y branding profesional.' 
    : 'Tips, guides, and insights about AI headshots, team photos, and professional branding.';
    
  return {
    title,
    description,
    alternates: {
      canonical: '/blog',
      languages: {
        'en': '/blog',
        'es': '/es/blog',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const getCategoryColor = (category: string) => {
  const categoryMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    'LinkedIn': { bg: 'bg-gradient-to-br from-brand-primary-light to-brand-primary-lighter/50', text: 'text-brand-primary', border: 'border-brand-primary-light', glow: 'shadow-brand-primary/20' },
    'Comparisons': { bg: 'bg-gradient-to-br from-brand-premium/10 to-brand-premium/5', text: 'text-brand-premium', border: 'border-brand-premium/20', glow: 'shadow-brand-premium/20' },
    'Teams': { bg: 'bg-gradient-to-br from-brand-secondary-light to-brand-secondary-lighter/50', text: 'text-brand-secondary-text', border: 'border-brand-secondary-border', glow: 'shadow-brand-secondary/20' },
    'Guides': { bg: 'bg-gradient-to-br from-brand-cta-light to-brand-cta-lighter/50', text: 'text-brand-cta-text', border: 'border-brand-cta-border', glow: 'shadow-brand-cta/20' },
    'Comparaciones': { bg: 'bg-gradient-to-br from-brand-premium/10 to-brand-premium/5', text: 'text-brand-premium', border: 'border-brand-premium/20', glow: 'shadow-brand-premium/20' },
    'Equipos': { bg: 'bg-gradient-to-br from-brand-secondary-light to-brand-secondary-lighter/50', text: 'text-brand-secondary-text', border: 'border-brand-secondary-border', glow: 'shadow-brand-secondary/20' },
    'Guías': { bg: 'bg-gradient-to-br from-brand-cta-light to-brand-cta-lighter/50', text: 'text-brand-cta-text', border: 'border-brand-cta-border', glow: 'shadow-brand-cta/20' },
  };
  return categoryMap[category] || { bg: 'bg-gradient-to-br from-bg-gray-50 to-bg-gray-50/50', text: 'text-text-body', border: 'border-bg-gray-50', glow: 'shadow-text-muted/10' };
};

export default async function BlogIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const posts = locale === 'es' ? esPosts : enPosts;

  return (
    <div>
      <header className="mb-20 sm:mb-24 lg:mb-32 relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-gradient-to-br from-brand-primary/10 via-brand-primary-hover/8 to-brand-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute top-20 right-8 w-24 h-24 bg-gradient-to-br from-brand-primary/6 via-brand-primary-hover/4 to-brand-primary/6 rounded-full blur-2xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold text-text-dark mb-6 sm:mb-8 tracking-tight leading-[1.1] relative z-10">
          Blog
        </h1>
        <p className="text-xl sm:text-2xl md:text-3xl text-text-body leading-[1.5] max-w-4xl font-medium relative z-10" role="doc-subtitle">
          {locale === 'es' 
            ? 'Consejos, guías e insights sobre headshots AI, fotos de equipo y branding profesional.'
            : 'Tips, guides, and insights about AI headshots, team photos, and professional branding.'}
        </p>
      </header>

      {posts.length > 0 && (
        <>
          {/* Featured Post */}
          <article className="mb-16 sm:mb-20 lg:mb-28">
            <Link 
              href={`/${locale}/blog/${posts[0].slug}`} 
              className="group block focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary rounded-2xl focus-visible:ring-4 focus-visible:ring-brand-primary/20"
              aria-label={`${locale === 'es' ? 'Publicación destacada' : 'Featured post'}: ${posts[0].title}`}
            >
              <div className="bg-bg-white backdrop-blur-md rounded-2xl border-2 border-bg-gray-50 p-8 sm:p-10 md:p-12 lg:p-16 hover:border-brand-primary/60 focus-within:border-brand-primary/60 hover:shadow-2xl hover:shadow-brand-primary/20 hover:-translate-y-2 transition-all duration-500 ease-out shadow-xl relative overflow-hidden group/featured will-change-transform">
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/0 via-transparent to-brand-primary-hover/0 group-hover/featured:from-brand-primary/8 group-hover/featured:via-brand-primary/4 group-hover/featured:to-brand-primary-hover/8 transition-all duration-700 pointer-events-none" />
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full group-hover/featured:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-primary/5 to-transparent rounded-bl-full opacity-0 group-hover/featured:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8 sm:mb-10">
                    <span className="inline-flex items-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-extrabold bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-primary text-white group-hover:from-brand-primary-hover group-hover:via-brand-primary-hover group-hover:to-brand-primary-hover transition-all duration-300 shadow-lg shadow-brand-primary/30 group-hover:shadow-xl group-hover:shadow-brand-primary/40 group-hover:scale-105">
                      {locale === 'es' ? 'Destacado' : 'Featured'}
                    </span>
                    <span className={`inline-flex items-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold border ${getCategoryColor(posts[0].category).bg} ${getCategoryColor(posts[0].category).text} ${getCategoryColor(posts[0].category).border} transition-all duration-300 shadow-md ${getCategoryColor(posts[0].category).glow} group-hover:scale-110 group-hover:shadow-lg`}>
                      {posts[0].category}
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-text-dark group-hover/featured:text-transparent group-hover/featured:bg-gradient-to-r group-hover/featured:from-brand-primary group-hover/featured:via-brand-primary-hover group-hover/featured:to-brand-primary group-hover/featured:bg-clip-text transition-all duration-500 mb-6 sm:mb-8 leading-[1.1] tracking-tight group-hover/featured:scale-[1.01]">
                    {posts[0].title}
                  </h2>
                  <p className="text-xl sm:text-2xl text-text-body mb-8 sm:mb-10 lg:mb-12 leading-[1.6] group-hover:text-text-dark transition-colors font-medium">{posts[0].description}</p>
                  <div className="flex flex-wrap items-center gap-4 sm:gap-5 text-sm sm:text-base text-text-muted group-hover:text-text-body transition-colors">
                    <time dateTime={posts[0].date} className="font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(posts[0].date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                    <span className="text-text-muted/30 hidden sm:inline">·</span>
                    <span className="font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {posts[0].readTime}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </article>

          {/* Other Posts Grid - Asymmetric layout */}
          <section aria-label={locale === 'es' ? 'Publicaciones del blog' : 'Blog posts'} className="grid gap-8 sm:gap-10 md:gap-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {posts.slice(1).map((post, index) => {
              const categoryColors = getCategoryColor(post.category);
              // Create asymmetric pattern: every 3rd card is slightly taller, every 4th card has different styling
              const isTallCard = index % 3 === 1;
              const isAccentCard = index % 4 === 2;
              return (
                <article 
                  key={post.slug} 
                  className={`opacity-0 animate-[fadeInUp_0.6s_ease-out_forwards] ${isTallCard ? 'sm:row-span-1' : ''} ${isAccentCard ? 'lg:col-span-1' : ''}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <Link 
                    href={`/${locale}/blog/${post.slug}`} 
                    className="group block h-full focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary rounded-2xl focus-visible:ring-4 focus-visible:ring-brand-primary/20"
                    aria-label={`${locale === 'es' ? 'Leer artículo' : 'Read article'}: ${post.title}`}
                  >
                    <div className={`bg-bg-white backdrop-blur-sm rounded-2xl border p-6 sm:p-7 md:p-8 hover:border-brand-primary/60 focus-within:border-brand-primary/60 hover:shadow-xl hover:shadow-brand-primary/15 hover:-translate-y-1.5 transition-all duration-500 ease-out h-full flex flex-col shadow-lg relative overflow-hidden group/card will-change-transform ${isAccentCard ? 'border-2 border-bg-gray-50' : 'border border-bg-gray-50'}`}>
                      {/* Animated gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-brand-primary/0 group-hover/card:from-brand-primary/6 group-hover/card:via-brand-primary/3 group-hover/card:to-brand-primary-hover/6 transition-all duration-600 pointer-events-none" />
                      {/* Subtle shimmer */}
                      <div className="absolute inset-0 -translate-x-full group-hover/card:translate-x-full transition-transform duration-1200 ease-in-out bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="mb-5 sm:mb-6">
                          <span className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold border ${categoryColors.bg} ${categoryColors.text} ${categoryColors.border} transition-all duration-300 shadow-sm ${categoryColors.glow} group-hover:scale-110 group-hover:shadow-md`}>
                            {post.category}
                          </span>
                        </div>
                        <h2 className={`text-xl sm:text-2xl md:text-3xl font-bold text-text-dark group-hover/card:text-transparent group-hover/card:bg-gradient-to-r group-hover/card:from-brand-primary group-hover/card:via-brand-primary-hover group-hover/card:to-brand-primary group-hover/card:bg-clip-text transition-all duration-400 mb-4 sm:mb-5 leading-[1.25] tracking-tight ${isTallCard ? 'md:text-2xl lg:text-3xl' : ''}`}>
                          {post.title}
                        </h2>
                        <p className={`text-base sm:text-lg text-text-body mb-6 sm:mb-7 leading-[1.65] flex-grow group-hover:text-text-dark transition-colors font-medium ${isTallCard ? 'text-lg sm:text-xl' : ''}`}>{post.description}</p>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm sm:text-base text-text-muted group-hover:text-text-body transition-colors mt-auto">
                          <time dateTime={post.date} className="font-medium flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(post.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </time>
                          <span className="text-text-muted/30 hidden sm:inline">·</span>
                          <span className="font-medium flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {post.readTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })}
          </section>
        </>
      )}

      {posts.length === 0 && (
        <div className="text-center py-16 sm:py-20" role="status" aria-live="polite">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-gray-50 mb-6">
            <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-lg sm:text-xl text-text-muted font-medium">
            {locale === 'es' ? 'No hay publicaciones aún. ¡Vuelve pronto!' : 'No posts yet. Check back soon!'}
          </p>
        </div>
      )}
    </div>
  );
}

