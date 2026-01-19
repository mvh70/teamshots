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
      title: 'Headshots AI Profesionales: Crea Fotos de Calidad de Estudio en 2026',
      description: `Genera headshots profesionales AI en 2026 con resultados realistas. Compara las mejores herramientas para negocios, LinkedIn y uso en equipos. Ahorra tiempo y dinero.`,
      breadcrumb: 'Headshots AI Profesionales',
      tldr: [
        '<strong>Calidad:</strong> La IA de 2026 produce headshots AI profesionales de nivel de estudio que rivalizan con los fotógrafos.',
        '<strong>Costo:</strong> $15-50 vs $200-500 tradicional - 80-90% de ahorro.',
        `<strong>Mejor Herramienta:</strong> ${brandName} para equipos y consistencia.`
      ],
      sections: {
        why: {
          title: '¿Por Qué Headshots AI Profesionales en 2026?',
          p1: 'Con los avances de la IA, los headshots profesionales AI son ahora realistas y accesibles. Investigaciones muestran que el 65% de los solicitantes de empleo usan IA en alguna parte de su solicitud, incluyendo headshots profesionales. La tecnología ha mejorado dramáticamente: la IA moderna produce resultados indistinguibles de la fotografía de estudio.',
          p2: 'Los beneficios son claros: los headshots profesionales AI cuestan 80-90% menos que la fotografía tradicional, toman minutos en lugar de semanas, y entregan resultados consistentes perfectos para LinkedIn, sitios web de empresas y materiales de negocios.'
        },
        tools: {
          title: 'Mejores Herramientas de Headshots AI Profesionales 2026',
          table: {
            headers: ['Herramienta', 'Mejor Para', 'Precio', 'Velocidad', 'Calidad'],
            rows: [
              [`${brandName}`, 'Consistencia de equipo', '$49/equipo', '60 segundos', '⭐⭐⭐⭐⭐'],
              ['HeadshotPro', 'Individuos', '$29+', '2 horas', '⭐⭐⭐⭐⭐'],
              ['BetterPic', 'Fotos profesionales rápidas', '$29+', 'Minutos', '⭐⭐⭐⭐⭐'],
              ['Aragon AI', 'Variedad de estilos', '$29+', '1-2 horas', '⭐⭐⭐⭐']
            ]
          }
        },
        bestPractices: {
          title: 'Mejores Prácticas para Headshots AI Profesionales',
          p1: 'Para obtener los mejores resultados de headshots AI profesionales, sigue estas mejores prácticas de 2026:',
          items: [
            { title: '1. Empieza con Entrada de Alta Calidad', text: 'Usa selfies nítidas y bien iluminadas. La luz natural cerca de una ventana funciona mejor. Cuanto mejor sea tu entrada, mejor será la salida de tu headshot profesional AI.' },
            { title: '2. Coincide con Tu Marca', text: 'Elige fondos, vestimenta y expresiones que se alineen con tu industria y cultura empresarial. ¿Finanzas? Ve formal. ¿Tecnología? Casual elegante funciona.' },
            { title: '3. Asegura Consistencia para Equipos', text: 'Para uso corporativo, usa herramientas diseñadas para equipos. Fondos, iluminación y estilos coincidentes en todos los miembros del equipo construyen reconocimiento de marca.' },
            { title: '4. Mantenlo Auténtico', text: 'Tu headshot profesional AI aún debe parecerse a ti. Evita resultados demasiado filtrados que te hagan irreconocible. Prueba con colegas antes de usar públicamente.' },
            { title: '5. Úsalo en Todos los Canales', text: 'Mantén la consistencia en LinkedIn, firmas de correo, sitios web de la empresa y tarjetas de presentación. Los headshots profesionales AI hacen esto fácil y asequible.' }
          ]
        },
        costComparison: {
          title: 'Comparación de Costos: Headshots AI Profesionales vs Tradicional',
          p1: 'Desglosemos los costos reales:',
          table: {
            headers: ['Factor de Costo', 'Fotografía Tradicional', 'Headshots AI Profesionales'],
            rows: [
              ['Costo por persona', '$200-500', '$15-50'],
              ['Tiempo de entrega', '2-4 semanas', 'Minutos a horas'],
              ['Retomas/variaciones', 'Costo extra', 'Incluido'],
              ['Consistencia de equipo', 'Requiere coordinación', 'Incorporada']
            ]
          }
        },
        useCases: {
          title: 'Casos de Uso para Headshots AI Profesionales',
          perfectFor: {
            title: '✅ Perfecto Para',
            items: ['• Perfiles de LinkedIn', '• Páginas "Sobre Nosotros" de empresas', '• Firmas de correo electrónico', '• Tarjetas de presentación', '• Conferencias', '• Sitios web de equipos', '• Propuestas a clientes']
          },
          considerTraditional: {
            title: '⚠️ Considera Tradicional Para',
            items: ['• Retratos ejecutivos C-suite', '• Materiales para inversores', '• Fotos grupales', '• Imágenes de oficina física', '• Retratos estilo editorial']
          }
        }
      },
      faqTitle: 'Preguntas Frecuentes',
      cta: {
        title: 'Obtén headshots profesionales AI de calidad de estudio',
        description: `Prueba ${brandName} para resultados realistas y consistentes en 60 segundos.`,
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
    title: 'Professional Headshots AI: Create Studio-Quality Photos in 2026',
    description: `Generate professional headshots AI in 2026 with realistic results. Compare top tools for business, LinkedIn, and team use. Save time and money.`,
    breadcrumb: 'Professional Headshots AI',
    tldr: [
      '<strong>Quality:</strong> 2026 AI produces studio-level professional headshots AI that rival photographers.',
      '<strong>Cost:</strong> $15-50 vs $200-500 traditional - 80-90% savings.',
      `<strong>Best Tool:</strong> ${brandName} for teams and consistency.`
    ],
    sections: {
      why: {
        title: 'Why Professional Headshots AI in 2026?',
        p1: 'With AI advancements, professional headshots AI are now realistic and accessible. Research shows 65% of job seekers use AI in some part of their application, including professional headshots. The technology has improved dramatically - modern AI produces results indistinguishable from studio photography.',
        p2: 'The benefits are clear: professional headshots AI cost 80-90% less than traditional photography, take minutes instead of weeks, and deliver consistent results perfect for LinkedIn, company websites, and business materials.'
      },
      tools: {
        title: 'Top Professional Headshots AI Tools 2026',
        table: {
          headers: ['Tool', 'Best For', 'Price', 'Speed', 'Quality'],
          rows: [
            [`${brandName}`, 'Team consistency', '$49/team', '60 seconds', '⭐⭐⭐⭐⭐'],
            ['HeadshotPro', 'Individuals', '$29+', '2 hours', '⭐⭐⭐⭐⭐'],
            ['BetterPic', 'Quick professional shots', '$29+', 'Minutes', '⭐⭐⭐⭐⭐'],
            ['Aragon AI', 'Style variety', '$29+', '1-2 hours', '⭐⭐⭐⭐']
          ]
        }
      },
      bestPractices: {
        title: 'Best Practices for Professional Headshots AI',
        p1: 'To get the best results from professional headshots AI, follow these 2026 best practices:',
        items: [
          { title: '1. Start with High-Quality Input', text: 'Use sharp, well-lit selfies. Natural light near a window works best. The better your input, the better your professional headshots AI output.' },
          { title: '2. Match Your Brand', text: 'Choose backgrounds, attire, and expressions that align with your industry and company culture. Finance? Go formal. Tech? Smart casual works.' },
          { title: '3. Ensure Consistency for Teams', text: 'For corporate use, use tools designed for teams. Matching backgrounds, lighting, and styles across all team members builds brand recognition.' },
          { title: '4. Keep It Authentic', text: 'Your professional headshots AI should still look like you. Avoid overly filtered results that make you unrecognizable. Test with colleagues before using publicly.' },
          { title: '5. Use Across All Channels', text: 'Maintain consistency across LinkedIn, email signatures, company websites, and business cards. Professional headshots AI make this easy and affordable.' }
        ]
      },
      costComparison: {
        title: 'Cost Comparison: Professional Headshots AI vs Traditional',
        p1: 'Let\'s break down the real costs:',
        table: {
          headers: ['Cost Factor', 'Traditional Photography', 'Professional Headshots AI'],
          rows: [
            ['Per-person cost', '$200-500', '$15-50'],
            ['Turnaround time', '2-4 weeks', 'Minutes to hours'],
            ['Retakes/variations', 'Extra cost', 'Included'],
            ['Team consistency', 'Requires coordination', 'Built-in']
          ]
        }
      },
      useCases: {
        title: 'Use Cases for Professional Headshots AI',
        perfectFor: {
          title: '✅ Perfect For',
          items: ['• LinkedIn profiles', '• Company "About Us" pages', '• Email signatures', '• Business cards', '• Speaking engagements', '• Team websites', '• Client proposals']
        },
        considerTraditional: {
          title: '⚠️ Consider Traditional For',
          items: ['• C-suite executive portraits', '• Investor materials', '• Group photos', '• Physical office imagery', '• Editorial-style portraits']
        }
      }
    },
    faqTitle: 'Frequently Asked Questions',
    cta: {
      title: 'Get studio-quality professional headshots AI',
      description: `Try ${brandName} for realistic, consistent results in 60 seconds.`,
      button: `Try ${brandName} →`
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
        question: '¿Qué tan realistas son los headshots AI profesionales en 2026?',
        answer: 'Muy realistas: las mejores herramientas producen resultados indistinguibles de la fotografía de estudio, con textura de piel natural, iluminación realista y expresiones auténticas. Investigaciones muestran que el 87% de los reclutadores no pueden notar la diferencia.',
      },
      {
        question: '¿Puede la IA crear headshots profesionales para equipos?',
        answer: `Sí, herramientas como ${brandName} aseguran consistencia en los miembros del equipo con estilos, fondos e iluminación coincidentes. Esto es crucial para uso corporativo donde la consistencia construye reconocimiento de marca.`,
      },
      {
        question: '¿Cuánto cuestan los headshots AI profesionales?',
        answer: 'Los headshots AI profesionales cuestan $15-50 por persona vs $200-500 para fotógrafos tradicionales. Eso es un ahorro del 80-90%. Para equipos, los precios por volumen lo hacen aún más rentable.',
      },
      {
        question: '¿Son los headshots AI profesionales adecuados para LinkedIn?',
        answer: 'Sí, los headshots AI profesionales de alta calidad son perfectos para LinkedIn. Proporcionan la apariencia profesional que esperan los reclutadores, con iluminación y fondos adecuados. Solo asegúrate de que el resultado aún se parezca a ti.',
      },
      {
        question: '¿Qué hace un buen headshot AI profesional?',
        answer: 'Textura de piel natural (no aerografiada), iluminación y sombras realistas, expresiones auténticas, fondos profesionales limpios y, lo más importante: aún debe parecerse a ti. Evita resultados demasiado filtrados o tipo caricatura.',
      },
    ];
  }

  // English
  return [
    {
      question: 'How realistic are AI professional headshots in 2026?',
      answer: 'Very realistic - top tools produce results indistinguishable from studio photography, with natural skin texture, realistic lighting, and authentic expressions. Research shows 87% of recruiters can\'t tell the difference.',
    },
    {
      question: 'Can AI create professional headshots for teams?',
      answer: `Yes, tools like ${brandName} ensure consistency across team members with matching styles, backgrounds, and lighting. This is crucial for corporate use where consistency builds brand recognition.`,
    },
    {
      question: 'How much do AI professional headshots cost?',
      answer: 'AI professional headshots cost $15-50 per person vs $200-500 for traditional photographers. That\'s 80-90% savings. For teams, bulk pricing makes it even more cost-effective.',
    },
    {
      question: 'Are professional headshots AI suitable for LinkedIn?',
      answer: 'Yes, high-quality AI professional headshots are perfect for LinkedIn. They provide the professional appearance recruiters expect, with proper lighting and backgrounds. Just ensure the result still looks like you.',
    },
    {
      question: 'What makes a good professional headshot AI?',
      answer: 'Natural skin texture (not airbrushed), realistic lighting and shadows, authentic expressions, clean professional backgrounds, and most importantly - it should still look like you. Avoid overly filtered or cartoon-like results.',
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
      canonical: '/blog/professional-headshots-ai',
      languages: {
        en: '/blog/professional-headshots-ai',
        es: '/es/blog/professional-headshots-ai',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ProfessionalHeadshotsAIPage({ params }: Props) {
  const { locale } = await params;
  const headersList = await headers();
  const brandConfig = getBrand(headersList);
  const baseUrl = getBaseUrl(headersList);
  
  const content = getContent(locale, brandConfig.name);
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
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/professional-headshots-ai`}
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
            <p>{content.author.title} · {locale === 'es' ? 'Actualizado Nov 2026' : 'Updated Nov 2026'}</p>
          </div>
        </div>

        <TldrSection>
          {content.tldr.map((item, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </TldrSection>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.why.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.why.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.why.p2}
        </p>

        {/* Tool Comparison */}
        <h2 className="text-2xl font-bold mt-12 mb-6 text-gray-900">
          {content.sections.tools.title}
        </h2>

        <div className="overflow-x-auto mb-10">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.tools.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.tools.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border border-gray-200 p-3 font-medium">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.bestPractices.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.bestPractices.p1}
        </p>

        <div className="space-y-4 mb-6">
          {content.sections.bestPractices.items.map((item, i) => (
            <div key={i} className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.costComparison.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.costComparison.p1}
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.costComparison.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.costComparison.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border border-gray-200 p-3 font-medium">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.useCases.title}
        </h2>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">{content.sections.useCases.perfectFor.title}</h3>
            <ul className="space-y-1 text-gray-700 text-sm">
              {content.sections.useCases.perfectFor.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">{content.sections.useCases.considerTraditional.title}</h3>
            <ul className="space-y-1 text-gray-700 text-sm">
              {content.sections.useCases.considerTraditional.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
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
