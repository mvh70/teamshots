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

const getContent = (locale: string, brandName: string) => {
  if (locale === 'es') {
    return {
      title: 'Generador de Headshots AI 2025: Crea Fotos Profesionales Instantáneamente',
      description: `Mejor generador de headshots AI para 2025. Genera headshots ai desde selfies en segundos. Compara herramientas por calidad y velocidad.`,
      breadcrumb: 'Generador de Headshots AI',
      tldr: [
        '<strong>Velocidad:</strong> Los generadores de headshots AI crean fotos en segundos a minutos.',
        '<strong>Calidad:</strong> Las herramientas de 2025 igualan la fotografía de estudio con resultados realistas.',
        '<strong>Mejor Uso:</strong> LinkedIn, perfiles de negocios, equipos, sitios web de empresas.'
      ],
      sections: {
        howItWorks: {
          title: 'Cómo Funcionan los Generadores de Headshots AI en 2025',
          p1: 'Un generador de headshots AI utiliza inteligencia artificial avanzada para transformar tus selfies en fotos profesionales. El proceso es simple: sube una foto, elige tus preferencias de estilo y la IA se encarga del resto: mejorando la iluminación, añadiendo fondos profesionales, ajustando la vestimenta y creando resultados de calidad de estudio.',
          p2: 'La tecnología ha mejorado dramáticamente en 2025. Los generadores de headshots AI modernos producen resultados indistinguibles de la fotografía tradicional, con textura de piel natural, iluminación realista y expresiones auténticas. Investigaciones muestran que el 65% de los solicitantes de empleo ahora usan IA en alguna parte de su solicitud, incluyendo headshots.',
          boxTitle: 'El Proceso',
          steps: ['Sube una selfie (luz natural, mirando a la cámara, fondo neutro)', 'Elige preferencias de estilo (fondo, vestimenta, expresión)', 'La IA procesa tu foto (típicamente 60 segundos a 2 horas)', 'Revisa y descarga tus headshots profesionales']
        },
        bestGenerators: {
          title: 'Mejores Generadores de Headshots AI 2025',
          p1: 'Basado en nuestra investigación y pruebas, estos son los mejores generadores de headshots AI para 2025:',
          items: [
            { title: `${brandName} - Mejor para Equipos`, desc: 'Genera headshots coincidentes para equipos enteros en 60 segundos. Asegura consistencia en todos los miembros del equipo con los mismos fondos y estilos. Desde $49 para equipos.', bestFor: 'Startups, equipos remotos, sitios web de empresas' },
            { title: 'BetterPic - Mejor por Velocidad', desc: 'Generador de headshots AI rápido y realista con resultados en minutos. Ofrece nivel gratuito con opciones sin marca de agua. Genial para individuos que necesitan resultados rápidos.', bestFor: 'Fotos profesionales rápidas, uso individual' },
            { title: 'HeadshotPro - Mejor por Calidad', desc: 'Generador de headshots AI de alta calidad con múltiples opciones de estilo. Tarda más de 2 horas pero entrega resultados excepcionales. Desde $29 por persona.', bestFor: 'Profesionales individuales, calidad premium' },
            { title: 'Photify AI - Mejor por Variedad', desc: 'Ofrece amplia variedad de estilos incluyendo diferentes épocas, atuendos y opciones creativas. Procesamiento rápido con resultados de buena calidad.', bestFor: 'Profesionales creativos, experimentación de estilo' }
          ]
        },
        whatToLookFor: {
          title: 'Qué Buscar en un Generador de Headshots AI',
          mustHaves: {
            title: '✅ Imprescindibles',
            items: ['• Alta resolución (1024x1024 mínimo)', '• Resultados de aspecto natural (no caricaturescos)', '• Múltiples opciones de estilo/fondo', '• Sin marcas de agua en las salidas', '• Derechos de uso comercial incluidos', '• Procesamiento rápido (menos de 2 horas)']
          },
          niceToHaves: {
            title: '⭐ Deseables',
            items: ['• Múltiples variaciones por generación', '• Reintentos gratuitos para perfeccionar resultados', '• Opciones de precios para equipos/volumen', '• Características de consistencia para equipos', '• Garantía de satisfacción', '• Acceso API para integraciones']
          }
        },
        useCases: {
          title: 'Casos de Uso Comunes para Generadores de Headshots AI',
          items: [
            { title: 'Perfiles de LinkedIn', text: 'Los perfiles con fotos profesionales obtienen 21x más vistas. Los generadores de headshots AI facilitan obtener fotos listas para LinkedIn.' },
            { title: 'Sitios Web de Empresas', text: 'Las páginas de equipo necesitan headshots consistentes y profesionales. Los generadores de headshots AI aseguran estilos coincidentes en todos los miembros del equipo.' },
            { title: 'Firmas de Correo', text: 'Los headshots profesionales en firmas de correo construyen confianza. Los generadores de headshots AI hacen esto asequible para equipos enteros.' },
            { title: 'Conferencias', text: 'Los organizadores de conferencias necesitan headshots profesionales. Los generadores de headshots AI entregan resultados de alta calidad rápidamente.' },
            { title: 'Tarjetas de Presentación', text: 'Las tarjetas de presentación modernas a menudo incluyen fotos. Los generadores de headshots AI proporcionan imágenes de alta resolución listas para imprimir.' }
          ]
        },
        tips: {
          title: 'Consejos para Mejores Resultados con Generadores de Headshots AI',
          items: [
            { title: 'Empieza con entrada de calidad', text: 'Usa selfies nítidas y bien iluminadas. La luz natural cerca de una ventana funciona mejor.' },
            { title: 'Elige estilos apropiados', text: 'Combina fondos y vestimenta con tu industria y caso de uso.' },
            { title: 'Revisa múltiples variaciones', text: 'La mayoría de los generadores de headshots AI proporcionan varias opciones. Elige la más natural.' },
            { title: 'Asegura la autenticidad', text: 'Tu headshot debe parecerse a ti. Evita resultados demasiado filtrados.' },
            { title: 'Prueba antes de usar', text: 'Muestra tu headshot a colegas o amigos para asegurar que te represente bien.' }
          ]
        }
      },
      faqTitle: 'Preguntas Frecuentes',
      cta: {
        title: 'Prueba un generador de headshots AI ahora',
        description: `Genera tu primera foto profesional con ${brandName} en 60 segundos.`,
        button: `Prueba ${brandName} →`
      },
      author: {
        title: `Fundador, ${brandName}`,
        bio: `Matthieu van Haperen es el fundador de ${brandName} y un ex venture builder con más de 6 años de experiencia en startups. Escribe sobre herramientas de IA, productividad y construcción en público.`
      }
    };
  }

  // English
  return {
    title: 'Headshot AI Generator 2025: Create Professional Photos Instantly',
    description: `Best headshot AI generator for 2025. Generate ai headshots from selfies in seconds. Compare tools for quality and speed.`,
    breadcrumb: 'Headshot AI Generator',
    tldr: [
      '<strong>Speed:</strong> Headshot AI generators create photos in seconds to minutes.',
      '<strong>Quality:</strong> 2025 tools match studio photography with realistic results.',
      '<strong>Best Use:</strong> LinkedIn, business profiles, teams, company websites.'
    ],
    sections: {
      howItWorks: {
        title: 'How Headshot AI Generators Work in 2025',
        p1: 'A headshot AI generator uses advanced artificial intelligence to transform your selfies into professional photos. The process is simple: upload a photo, choose your style preferences, and the AI handles the rest - enhancing lighting, adding professional backgrounds, adjusting attire, and creating studio-quality results.',
        p2: 'The technology has improved dramatically in 2025. Modern headshot AI generators produce results indistinguishable from traditional photography, with natural skin texture, realistic lighting, and authentic expressions. Research shows 65% of job seekers now use AI in some part of their application, including headshots.',
        boxTitle: 'The Process',
        steps: ['Upload a selfie (natural light, facing camera, neutral background)', 'Choose style preferences (background, attire, expression)', 'AI processes your photo (typically 60 seconds to 2 hours)', 'Review and download your professional headshots']
      },
      bestGenerators: {
        title: 'Best Headshot AI Generators 2025',
        p1: 'Based on our research and testing, here are the top headshot AI generators for 2025:',
        items: [
          { title: `${brandName} - Best for Teams`, desc: 'Generates matching headshots for entire teams in 60 seconds. Ensures consistency across all team members with same backgrounds and styles. Starting at $49 for teams.', bestFor: 'Startups, remote teams, company websites' },
          { title: 'BetterPic - Best for Speed', desc: 'Quick, realistic headshot AI generator with results in minutes. Offers free tier with watermark-free options. Great for individuals needing fast results.', bestFor: 'Quick professional shots, individual use' },
          { title: 'HeadshotPro - Best for Quality', desc: 'High-quality headshot AI generator with multiple style options. Takes 2+ hours but delivers exceptional results. Starting at $29 per person.', bestFor: 'Individual professionals, premium quality' },
          { title: 'Photify AI - Best for Variety', desc: 'Offers extensive style variety including different eras, outfits, and creative options. Fast processing with good quality results.', bestFor: 'Creative professionals, style experimentation' }
        ]
      },
      whatToLookFor: {
        title: 'What to Look for in a Headshot AI Generator',
        mustHaves: {
          title: '✅ Must-Haves',
          items: ['• High resolution (1024x1024 minimum)', '• Natural-looking results (not cartoonish)', '• Multiple style/background options', '• No watermarks on outputs', '• Commercial use rights included', '• Fast processing (under 2 hours)']
        },
        niceToHaves: {
          title: '⭐ Nice-to-Haves',
          items: ['• Multiple variations per generation', '• Free retries to perfect results', '• Team/bulk pricing options', '• Consistency features for teams', '• Satisfaction guarantee', '• API access for integrations']
        }
      },
      useCases: {
        title: 'Common Use Cases for Headshot AI Generators',
        items: [
          { title: 'LinkedIn Profiles', text: 'Profiles with professional photos get 21x more views. Headshot AI generators make it easy to get LinkedIn-ready photos.' },
          { title: 'Company Websites', text: 'Team pages need consistent, professional headshots. Headshot AI generators ensure matching styles across all team members.' },
          { title: 'Email Signatures', text: 'Professional headshots in email signatures build trust. Headshot AI generators make this affordable for entire teams.' },
          { title: 'Speaking Engagements', text: 'Conference organizers need professional headshots. Headshot AI generators deliver high-quality results quickly.' },
          { title: 'Business Cards', text: 'Modern business cards often include photos. Headshot AI generators provide print-ready, high-resolution images.' }
        ]
      },
      tips: {
        title: 'Tips for Best Results with Headshot AI Generators',
        items: [
          { title: 'Start with quality input', text: 'Use sharp, well-lit selfies. Natural light near a window works best.' },
          { title: 'Choose appropriate styles', text: 'Match backgrounds and attire to your industry and use case.' },
          { title: 'Review multiple variations', text: 'Most headshot AI generators provide several options. Pick the most natural-looking one.' },
          { title: 'Ensure authenticity', text: 'Your headshot should still look like you. Avoid overly filtered results.' },
          { title: 'Test before using', text: 'Show your headshot to colleagues or friends to ensure it represents you well.' }
        ]
      }
    },
    faqTitle: 'Frequently Asked Questions',
    cta: {
      title: 'Try a headshot AI generator now',
      description: `Generate your first professional photo with ${brandName} in 60 seconds.`,
      button: `Try ${brandName} →`
    },
    author: {
      title: `Founder, ${brandName}`,
      bio: `Matthieu van Haperen is the founder of ${brandName} and a former venture builder with 6+ years of experience in startups. He writes about AI tools, productivity, and building in public.`
    }
  };
};

const getFaqItems = (locale: string) => {
  if (locale === 'es') {
    return [
      {
        question: '¿Qué es un generador de headshots AI?',
        answer: 'Un generador de headshots AI utiliza inteligencia artificial para crear fotos profesionales a partir de tus selfies. Mejora la iluminación, añade fondos, ajusta la vestimenta y produce resultados de calidad de estudio en minutos en lugar de horas.',
      },
      {
        question: '¿Qué tan precisos son los generadores de headshots AI en 2025?',
        answer: 'Muy precisos: los mejores generadores de headshots AI producen resultados realistas con textura de piel natural, iluminación adecuada y expresiones auténticas. Investigaciones muestran que el 87% de los reclutadores no pueden distinguir los headshots AI de la fotografía tradicional.',
      },
      {
        question: '¿Puedo usar un generador de headshots AI gratis?',
        answer: 'Sí, existen opciones gratuitas como BetterPic y Fotor AI, pero tienen limitaciones: menor resolución, marcas de agua y estilos limitados. Para uso profesional, los generadores de headshots AI pagados ofrecen mejor calidad y características.',
      },
      {
        question: '¿Cuánto tarda un generador de headshots AI?',
        answer: `El tiempo de generación varía según la herramienta. Generadores rápidos como TeamShots tardan 60 segundos, mientras que otros tardan de 30 minutos a 2 horas. Las herramientas gratuitas suelen ser más lentas.`,
      },
      {
        question: '¿Qué hace un buen generador de headshots AI?',
        answer: 'Busca: alta resolución (1024x1024+), resultados de aspecto natural (no caricaturescos), múltiples opciones de estilo, procesamiento rápido, sin marcas de agua y derechos de uso comercial. Las características de consistencia de equipo son un plus para uso corporativo.',
      },
    ];
  }

  // English
  return [
    {
      question: 'What is a headshot AI generator?',
      answer: 'A headshot AI generator uses artificial intelligence to create professional photos from your selfies. It enhances lighting, adds backgrounds, adjusts attire, and produces studio-quality results in minutes instead of hours.',
    },
    {
      question: 'How accurate are headshot AI generators in 2025?',
      answer: 'Very accurate - top headshot AI generators produce realistic results with natural skin texture, proper lighting, and authentic expressions. Research shows 87% of recruiters can\'t distinguish AI headshots from traditional photography.',
    },
    {
      question: 'Can I use a headshot AI generator for free?',
      answer: 'Yes, free options exist like BetterPic and Fotor AI, but they have limitations: lower resolution, watermarks, and limited styles. For professional use, paid headshot AI generators offer better quality and features.',
    },
    {
      question: 'How long does a headshot AI generator take?',
      answer: 'Generation time varies by tool. Fast headshot AI generators like TeamShots take 60 seconds, while others take 30 minutes to 2 hours. Free tools are often slower.',
    },
    {
      question: 'What makes a good headshot AI generator?',
      answer: 'Look for: high resolution (1024x1024+), natural-looking results (not cartoonish), multiple style options, fast processing, no watermarks, and commercial use rights. Team consistency features are a plus for corporate use.',
    },
  ];
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const brandConfig = getBrand(headersList);
  const content = getContent(locale, brandConfig.name);

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
      canonical: '/blog/headshot-ai-generator',
      languages: {
        en: '/blog/headshot-ai-generator',
        es: '/es/blog/headshot-ai-generator',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HeadshotAIGeneratorPage({ params }: Props) {
  const { locale } = await params;
  const headersList = await headers();
  const brandConfig = getBrand(headersList);
  const baseUrl = getBaseUrl(headersList);
  
  const content = getContent(locale, brandConfig.name);
  const faqItems = getFaqItems(locale);

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
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/headshot-ai-generator`}
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
          {content.tldr.map((item, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </TldrSection>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.howItWorks.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.howItWorks.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.howItWorks.p2}
        </p>

        <div className="bg-blue-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">{content.sections.howItWorks.boxTitle}</h3>
          <ol className="space-y-2 text-blue-800 list-decimal list-inside">
            {content.sections.howItWorks.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        {/* Tool List */}
        <h2 className="text-2xl font-bold mt-12 mb-6 text-gray-900">
          {content.sections.bestGenerators.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.bestGenerators.p1}
        </p>

        <div className="space-y-4 mb-6">
          {content.sections.bestGenerators.items.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-700 text-sm mb-2">
                {item.desc}
              </p>
              <p className="text-gray-500 text-sm">{locale === 'es' ? 'Mejor para' : 'Best for'}: {item.bestFor}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.whatToLookFor.title}
        </h2>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">{content.sections.whatToLookFor.mustHaves.title}</h3>
            <ul className="space-y-1 text-green-800 text-sm">
              {content.sections.whatToLookFor.mustHaves.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">{content.sections.whatToLookFor.niceToHaves.title}</h3>
            <ul className="space-y-1 text-gray-700 text-sm">
              {content.sections.whatToLookFor.niceToHaves.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.useCases.title}
        </h2>

        <div className="space-y-4 mb-6">
          {content.sections.useCases.items.map((item, i) => (
            <div key={i} className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.tips.title}
        </h2>

        <div className="space-y-3 mb-6">
          {content.sections.tips.items.map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0 text-sm">
                {i + 1}
              </div>
              <div>
                <p className="text-gray-700"><strong>{item.title}:</strong> {item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mt-16 mb-6 text-gray-900">
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
