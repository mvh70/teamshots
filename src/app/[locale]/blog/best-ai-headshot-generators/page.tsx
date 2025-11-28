import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';
import { getBrand } from '@/config/brand';
import { getBaseUrl } from '@/lib/url';
import {
  ArticleJsonLd,
  FaqJsonLd,
  AuthorBox,
  TldrSection,
  Breadcrumb,
} from '@/components/blog';

type Props = {
  params: Promise<{ locale: string }>;
};

const getContent = (locale: string, brandName: string, brandDomain: string) => {
  const isEs = locale === 'es';

  if (isEs) {
    return {
      title: 'Mejores Generadores de Headshots AI en 2025 (Comparados y Revisados)',
      description: `Descubre los mejores generadores de headshots AI para 2025, incluyendo ${brandName}, HeadshotPro, BetterPic y Aragon AI. Compara calidad, velocidad y precio para headshots profesionales de AI.`,
      breadcrumb: 'Mejores Generadores de Headshots AI',
      tldr: {
        teams: { label: 'Mejor para equipos', text: `${brandName}: genera headshots coincidentes para equipos enteros en 60 segundos.` },
        individuals: { label: 'Mejor para individuos', text: 'HeadshotPro: resultados de alta calidad a $29 por persona, pero tarda más de 2 horas.' },
        budget: { label: 'Mejor opción económica', text: 'Try It On AI: comienza en $15, entrega en 30 minutos, calidad decente.' }
      },
      comparisonTitle: 'Comparación de Generadores de Headshots AI 2025',
      table: {
        headers: ['Herramienta', 'Mejor Para', 'Precio', 'Velocidad', 'Calidad'],
        rows: [
          { name: brandName, bestFor: 'Equipos y consistencia', price: 'Desde $49/equipo', speed: '60 segundos', quality: '⭐⭐⭐⭐⭐' },
          { name: 'BetterPic', bestFor: 'Fotos profesionales rápidas', price: '$29+', speed: 'Minutos', quality: '⭐⭐⭐⭐⭐' },
          { name: 'HeadshotPro', bestFor: 'Individuos', price: '$29+', speed: '2 horas', quality: '⭐⭐⭐⭐⭐' },
          { name: 'Aragon AI', bestFor: 'Variedad de estilos', price: '$29+', speed: '1-2 horas', quality: '⭐⭐⭐⭐' },
          { name: 'Try It On AI', bestFor: 'Presupuesto', price: '$15+', speed: '30 min', quality: '⭐⭐⭐' }
        ]
      },
      sections: {
        ourProduct: {
          title: `1. ${brandName}: Mejor para Equipos`,
          specs: { price: 'Desde $49 por equipo', speed: '60 segundos', bestFor: 'Empresas que necesitan fotos de equipo consistentes', website: brandDomain },
          p1: `${brandName} resuelve un problema que otras herramientas de headshots AI ignoran: la consistencia en un equipo. Cuando cada persona sube fotos por separado a herramientas como HeadshotPro, obtienes iluminación, fondos y estilos muy diferentes. ${brandName} genera headshots coincidentes que parecen tomados por el mismo fotógrafo.`,
          p2: 'El tiempo de generación de 60 segundos es significativamente más rápido que los competidores que tardan horas. Para startups y equipos remotos que necesitan fotos profesionales rápidamente, esta es la mejor opción.'
        },
        headshotPro: {
          title: '2. HeadshotPro',
          specs: { price: '$29+ por persona', speed: '2+ horas', bestFor: 'Profesionales individuales' },
          p1: 'HeadshotPro es uno de los generadores de headshots AI más establecidos. Producen headshots individuales de alta calidad con múltiples opciones de fondo y estilo. La calidad es excelente, pero el precio por persona suma rápidamente para equipos.'
        },
        aragon: {
          title: '3. Aragon AI',
          specs: { price: '$29+ por persona', speed: '1-2 horas', bestFor: 'Profesionales creativos que buscan variedad' },
          p1: 'Aragon ofrece más variedad de estilos que sus competidores, incluyendo opciones casuales y creativas más allá de los headshots corporativos estándar. Buena elección si necesitas fotos para diferentes contextos.'
        }
      },
      faqTitle: 'Preguntas Frecuentes',
      cta: {
        title: '¿Listo para crear headshots de equipo profesionales?',
        description: 'Obtén headshots coincidentes para todo tu equipo en 60 segundos.',
        button: `Prueba ${brandName} Gratis →`
      },
      author: {
        title: `Fundador, ${brandName}`,
        bio: `Matthieu van Haperen es el fundador de ${brandName} y un ex venture builder con más de 6 años de experiencia en startups. Escribe sobre herramientas de IA, productividad y construcción en público.`
      }
    };
  }

  // Default English
  return {
    title: 'Best AI Headshot Generators in 2025 (Compared & Reviewed)',
    description: `Discover the best AI headshot generators for 2025, including ${brandName}, HeadshotPro, BetterPic, and Aragon AI. Compare quality, speed, and price for professional ai headshots.`,
    breadcrumb: 'Best AI Headshot Generators',
    tldr: {
      teams: { label: 'Best for teams', text: `${brandName}: generates matching headshots for entire teams in 60 seconds.` },
      individuals: { label: 'Best for individuals', text: 'HeadshotPro: high quality results at $29 per person, but takes 2+ hours.' },
      budget: { label: 'Best budget option', text: 'Try It On AI: starts at $15, 30-minute turnaround, decent quality.' }
    },
    comparisonTitle: 'Best AI Headshot Generator Comparison 2025',
    table: {
      headers: ['Tool', 'Best For', 'Price', 'Speed', 'Quality'],
      rows: [
        { name: brandName, bestFor: 'Teams & consistency', price: 'From $49/team', speed: '60 seconds', quality: '⭐⭐⭐⭐⭐' },
        { name: 'BetterPic', bestFor: 'Quick professional shots', price: '$29+', speed: 'Minutes', quality: '⭐⭐⭐⭐⭐' },
        { name: 'HeadshotPro', bestFor: 'Individuals', price: '$29+', speed: '2 hours', quality: '⭐⭐⭐⭐⭐' },
        { name: 'Aragon AI', bestFor: 'Style variety', price: '$29+', speed: '1-2 hours', quality: '⭐⭐⭐⭐' },
        { name: 'Try It On AI', bestFor: 'Budget', price: '$15+', speed: '30 min', quality: '⭐⭐⭐' }
      ]
    },
    sections: {
      ourProduct: {
        title: `1. ${brandName}: Best for Teams`,
        specs: { price: 'From $49 per team', speed: '60 seconds', bestFor: 'Companies needing consistent team photos', website: brandDomain },
        p1: `${brandName} solves a problem other AI headshot tools ignore: consistency across a team. When each person uploads photos separately to tools like HeadshotPro, you get wildly different lighting, backgrounds, and styles. ${brandName} generates matching headshots that look like everyone visited the same photographer.`,
        p2: 'The 60-second generation time is also significantly faster than competitors who take hours. For startups and remote teams who need professional photos quickly, this is the best option.'
      },
      headshotPro: {
        title: '2. HeadshotPro',
        specs: { price: '$29+ per person', speed: '2+ hours', bestFor: 'Individual professionals' },
        p1: 'HeadshotPro is one of the most established AI headshot generators. They produce high-quality individual headshots with multiple background and style options. Quality is excellent, but the per-person pricing adds up quickly for teams.'
      },
      aragon: {
        title: '3. Aragon AI',
        specs: { price: '$29+ per person', speed: '1-2 hours', bestFor: 'Creative professionals wanting variety' },
        p1: 'Aragon offers more style variety than competitors, including casual and creative options beyond standard corporate headshots. Good choice if you need photos for different contexts.'
      }
    },
    faqTitle: 'Frequently Asked Questions',
    cta: {
      title: 'Ready to create professional team headshots?',
      description: 'Get matching headshots for your entire team in 60 seconds.',
      button: `Try ${brandName} Free →`
    },
    author: {
      title: `Founder, ${brandName}`,
      bio: `Matthieu van Haperen is the founder of ${brandName} and a former venture builder with 6+ years of experience in startups. He writes about AI tools, productivity, and building in public.`
    }
  };
};

const getFaqItems = (locale: string, brandName: string) => {
  if (locale === 'es') {
    return [
      {
        question: '¿Cuál es el mejor generador de headshots AI en 2025?',
        answer: `Para equipos que necesitan headshots consistentes, ${brandName} es la mejor opción con generación en 60 segundos. Para individuos, HeadshotPro y Aragon AI ofrecen resultados de alta calidad desde $29.`,
      },
      {
        question: '¿Cuánto cuestan los headshots AI?',
        answer: `Los headshots AI típicamente cuestan $15-50 por persona, comparado con $200-500 para fotografía tradicional. ${brandName} ofrece precios para equipos, mientras que HeadshotPro comienza en $29 por persona.`,
      },
      {
        question: '¿Son los headshots AI suficientemente buenos para LinkedIn?',
        answer: 'Sí, los generadores modernos de headshots AI producen fotos de calidad profesional adecuadas para LinkedIn, sitios web de empresas y tarjetas de presentación. Las mejores herramientas son indistinguibles de la fotografía profesional.',
      },
      {
        question: '¿Cuánto tarda en generarse un headshot AI?',
        answer: `El tiempo de generación varía según la herramienta: ${brandName} tarda unos 60 segundos, Try It On AI tarda 30 minutos, y HeadshotPro/Aragon tardan 1-2 horas.`,
      },
    ];
  }
  
  // Default English
  return [
    {
      question: 'What is the best AI headshot generator in 2025?',
      answer: `For teams needing consistent headshots, ${brandName} is the best choice with 60-second generation. For individuals, HeadshotPro and Aragon AI offer high-quality results at $29+.`,
    },
    {
      question: 'How much do AI headshots cost?',
      answer: `AI headshots typically cost $15-50 per person, compared to $200-500 for traditional photography. ${brandName} offers team pricing, while HeadshotPro starts at $29 per person.`,
    },
    {
      question: 'Are AI headshots good enough for LinkedIn?',
      answer:
        'Yes, modern AI headshot generators produce professional-quality photos suitable for LinkedIn, company websites, and business cards. The best tools are indistinguishable from professional photography.',
    },
    {
      question: 'How long does it take to generate AI headshots?',
      answer: `Generation time varies by tool: ${brandName} takes about 60 seconds, Try It On AI takes 30 minutes, and HeadshotPro/Aragon take 1-2 hours.`,
    },
  ];
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const brandConfig = getBrand(headersList);
  const content = getContent(locale, brandConfig.name, brandConfig.domain);

  return {
    title: content.title,
    description: content.description,
    openGraph: {
      title: content.title,
      description: content.description,
      type: 'article',
      publishedTime: '2025-11-28',
      authors: ['Matthieu van Haperen'],
    },
    alternates: {
      canonical: '/blog/best-ai-headshot-generators',
      languages: {
        en: '/blog/best-ai-headshot-generators',
        es: '/es/blog/best-ai-headshot-generators',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function BestAIHeadshotGeneratorsPage({ params }: Props) {
  const { locale } = await params;
  const headersList = await headers();
  const brandConfig = getBrand(headersList);
  const baseUrl = getBaseUrl(headersList);
  
  const content = getContent(locale, brandConfig.name, brandConfig.domain);
  const faqItems = getFaqItems(locale, brandConfig.name);

  return (
    <>
      <ArticleJsonLd
        headline={content.title}
        description={content.description}
        authorName="Matthieu van Haperen"
        authorUrl="https://linkedin.com/in/yourprofile"
        authorJobTitle={`Founder, ${brandConfig.name}`}
        publisherName={brandConfig.name}
        publisherUrl={baseUrl}
        datePublished="2025-11-28"
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/best-ai-headshot-generators`}
      />
      <FaqJsonLd items={faqItems} />

      <article>
        <Breadcrumb
          items={[
            { label: locale === 'es' ? 'Inicio' : 'Home', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: content.breadcrumb },
          ]}
        />

        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          {content.title}
        </h1>

        {/* Author byline */}
        <div className="flex items-center gap-3 mb-8 text-sm text-gray-600">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
            MH
          </div>
          <div>
            <p className="font-medium text-gray-900">Matthieu van Haperen</p>
            <p>{content.author.title} · {locale === 'es' ? 'Actualizado Nov 2025' : 'Updated Nov 2025'}</p>
          </div>
        </div>

        <TldrSection>
          <p>
            <strong>{content.tldr.teams.label}:</strong> {content.tldr.teams.text}
          </p>
          <p>
            <strong>{content.tldr.individuals.label}:</strong> {content.tldr.individuals.text}
          </p>
          <p>
            <strong>{content.tldr.budget.label}:</strong> {content.tldr.budget.text}
          </p>
        </TldrSection>

        {/* Comparison Table */}
        <h2 id="comparison" className="text-2xl font-bold mt-12 mb-6 text-gray-900">
          {content.comparisonTitle}
        </h2>

        <div className="overflow-x-auto mb-10">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.table.rows.map((row, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 p-3 font-medium">{row.name}</td>
                  <td className="border border-gray-200 p-3">{row.bestFor}</td>
                  <td className="border border-gray-200 p-3">{row.price}</td>
                  <td className="border border-gray-200 p-3">{row.speed}</td>
                  <td className="border border-gray-200 p-3">{row.quality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Our Product Section */}
        <h2 id="our-product" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.ourProduct.title}
        </h2>

        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <ul className="space-y-1 text-sm">
            <li>
              <strong>{locale === 'es' ? 'Precio' : 'Price'}:</strong> {content.sections.ourProduct.specs.price}
            </li>
            <li>
              <strong>{locale === 'es' ? 'Velocidad' : 'Speed'}:</strong> {content.sections.ourProduct.specs.speed}
            </li>
            <li>
              <strong>{locale === 'es' ? 'Mejor para' : 'Best for'}:</strong> {content.sections.ourProduct.specs.bestFor}
            </li>
            <li>
              <strong>{locale === 'es' ? 'Sitio Web' : 'Website'}:</strong> {content.sections.ourProduct.specs.website}
            </li>
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.ourProduct.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.ourProduct.p2}
        </p>

        {/* HeadshotPro Section */}
        <h2 id="headshotpro" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.headshotPro.title}
        </h2>

        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <ul className="space-y-1 text-sm">
            <li>
              <strong>{locale === 'es' ? 'Precio' : 'Price'}:</strong> {content.sections.headshotPro.specs.price}
            </li>
            <li>
              <strong>{locale === 'es' ? 'Velocidad' : 'Speed'}:</strong> {content.sections.headshotPro.specs.speed}
            </li>
            <li>
              <strong>{locale === 'es' ? 'Mejor para' : 'Best for'}:</strong> {content.sections.headshotPro.specs.bestFor}
            </li>
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.headshotPro.p1}
        </p>

        {/* Aragon Section */}
        <h2 id="aragon" className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.aragon.title}
        </h2>

        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <ul className="space-y-1 text-sm">
            <li>
              <strong>{locale === 'es' ? 'Precio' : 'Price'}:</strong> {content.sections.aragon.specs.price}
            </li>
            <li>
              <strong>{locale === 'es' ? 'Velocidad' : 'Speed'}:</strong> {content.sections.aragon.specs.speed}
            </li>
            <li>
              <strong>{locale === 'es' ? 'Mejor para' : 'Best for'}:</strong> {content.sections.aragon.specs.bestFor}
            </li>
          </ul>
        </div>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.aragon.p1}
        </p>

        {/* FAQ Section */}
        <h2 id="faq" className="text-2xl font-bold mt-16 mb-6 text-gray-900">
          {content.faqTitle}
        </h2>

        <div className="space-y-6">
          {faqItems.map((item, index) => (
            <div key={index}>
              <h3 className="font-semibold text-lg mb-2 text-gray-900">
                {item.question}
              </h3>
              <p className="text-gray-700">{item.answer}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 p-8 bg-gray-50 rounded-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            {content.cta.title}
          </h2>
          <p className="mb-6 text-gray-600">
            {content.cta.description}
          </p>
          <Link
            href="/"
            className="inline-block bg-brand-cta text-white px-8 py-4 rounded-lg hover:bg-brand-cta-hover transition-colors font-medium"
          >
            {content.cta.button}
          </Link>
        </div>

        <AuthorBox
          name="Matthieu van Haperen"
          title={content.author.title}
          bio={content.author.bio}
          linkedInUrl="https://linkedin.com/in/yourprofile"
        />
      </article>
    </>
  );
}
