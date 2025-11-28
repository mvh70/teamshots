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

export default async function BlogIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const posts = locale === 'es' ? esPosts : enPosts;

  return (
    <div>
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Blog</h1>
      <p className="text-xl text-gray-600 mb-12">
        {locale === 'es' 
          ? 'Consejos, guías e insights sobre headshots AI, fotos de equipo y branding profesional.'
          : 'Tips, guides, and insights about AI headshots, team photos, and professional branding.'}
      </p>

      <div className="space-y-8">
        {posts.map((post) => (
          <article key={post.slug} className="border-b border-gray-200 pb-8">
            <Link href={`/${locale}/blog/${post.slug}`} className="group block">
              <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-brand-primary transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-gray-600 mb-3">{post.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span>·</span>
                <span>{post.readTime}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          {locale === 'es' ? 'No hay publicaciones aún. ¡Vuelve pronto!' : 'No posts yet. Check back soon!'}
        </p>
      )}
    </div>
  );
}

