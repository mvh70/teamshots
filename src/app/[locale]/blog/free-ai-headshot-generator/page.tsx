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
      title: 'Mejor Generador de Headshots AI Gratuito 2025: Resultados Realistas Sin Pagar',
      description: `Descubre el mejor generador de headshots AI gratuito para 2025. Crea headshots AI profesionales desde selfies sin marcas de agua ni límites. Compara las mejores herramientas gratuitas.`,
      breadcrumb: 'Headshot AI Gratuito',
      tldr: [
        '<strong>Mejor opción gratuita:</strong> BetterPic - Headshots AI gratuitos rápidos y realistas sin marcas de agua.',
        '<strong>Limitaciones:</strong> Las herramientas gratuitas suelen tener baja resolución y estilos básicos. Para uso profesional, considera opciones pagadas.',
        '<strong>Cuándo actualizar:</strong> Si necesitas alta resolución, derechos comerciales o consistencia para equipos.'
      ],
      sections: {
        whyUse: {
          title: '¿Por Qué Usar un Generador de Headshots AI Gratuito en 2025?',
          p1: 'Los generadores de headshots AI gratuitos han avanzado mucho en 2025. Con realismo mejorado y acceso sin costo, son perfectos para probar o uso casual. Según nuestra investigación, la adopción ha aumentado un 65% entre buscadores de empleo para actualizaciones rápidas de perfiles.',
          p2: 'El atractivo es obvio: ¿quién no quiere fotos de aspecto profesional sin gastar dinero? Pero aquí está lo que necesitas saber antes de sumergirte.'
        },
        topGenerators: {
          title: 'Mejores Generadores de Headshots AI Gratuitos 2025',
          table: {
            headers: ['Herramienta', 'Mejor Para', 'Velocidad', 'Calidad', 'Marcas de Agua'],
            rows: [
              ['BetterPic', 'Tomas realistas rápidas', 'Minutos', '⭐⭐⭐⭐', 'No'],
              ['Fotor AI', 'Edición básica', 'Segundos', '⭐⭐⭐', 'A veces'],
              ['ImagineArt', 'Estilos creativos', 'Minutos', '⭐⭐⭐⭐', 'No'],
              ['Vheer', 'Headshots básicos', 'Minutos', '⭐⭐⭐', 'A veces']
            ]
          }
        },
        whatTheyDoWell: {
          title: 'Lo Que Hacen Bien los Generadores de Headshots AI Gratuitos',
          p1: 'Las herramientas gratuitas tienen su lugar. Aquí está cuándo tienen sentido:',
          boxTitle: '✅ Buenos Casos de Uso para Herramientas Gratuitas',
          items: [
            '• Probar headshots AI antes de comprometerse con pagos',
            '• Avatares para juegos o perfiles de Discord',
            '• Cuentas de redes sociales personales donde la percepción profesional no importa',
            '• Marcador temporal mientras obtienes fotos adecuadas',
            '• Experimentos divertidos o probar diferentes looks'
          ]
        },
        hiddenCosts: {
          title: 'Los Costos Ocultos de "Gratis"',
          p1: 'Gratis no siempre significa gratis. Aquí está lo que podrías estar sacrificando:',
          boxTitle: '⚠️ Limitaciones Comunes',
          items: [
            '📉 <strong>Baja resolución:</strong> 512x512 o 1024x1024 máx - bien para miniaturas, no para impresión',
            '🎨 <strong>Estilos limitados:</strong> 2-5 fondos básicos vs. opciones ilimitadas en pagos',
            '⏰ <strong>Procesamiento lento:</strong> Algunas herramientas gratuitas toman 30+ minutos vs. 60 segundos para pagos',
            '🚫 <strong>Sin derechos comerciales:</strong> No se pueden usar para fines comerciales sin actualizar',
            '📊 <strong>Tus datos:</strong> Las herramientas gratuitas a menudo entrenan modelos con tus fotos'
          ]
        },
        whenNotEnough: {
          title: 'Cuando Gratis No Es Suficiente (Y Por Qué Actualizar a Pagado)',
          p1: `Las herramientas gratuitas son buenos inicios, pero para LinkedIn o uso profesional, opciones pagadas como ${brandName} ofrecen mejor realismo y sin límites.`,
          items: [
            { title: 'Perfil de LinkedIn', text: 'Los perfiles con fotos profesionales obtienen 21x más vistas. Las herramientas gratuitas a menudo se ven obviamente artificiales, perjudicando la credibilidad.' },
            { title: 'Sitio Web de la Empresa', text: 'Cuando los clientes visitan tu sitio, headshots de baja calidad señalan "recortamos esquinas." Las herramientas pagadas entregan resultados de calidad de estudio.' },
            { title: 'Consistencia para Equipos', text: 'Las herramientas gratuitas no pueden entregar estilos coincidentes a través de miembros del equipo. Para uso corporativo, la consistencia importa.' },
            { title: 'Uso Comercial', text: '¿Necesitas fotos para propuestas, decks de presentación o marketing? Las herramientas gratuitas a menudo restringen derechos comerciales.' }
          ]
        },
        roi: {
          title: 'La Matemática del ROI: Gratis vs Pagado',
          p1: 'Seamos honestos sobre el costo real:',
          table: {
            headers: ['Opción', 'Costo Directo', 'Costo de Tiempo', 'Calidad'],
            rows: [
              ['Herramientas AI gratuitas', '$0', '2-3 horas (prueba y error)', '⭐⭐⭐'],
              [`AI Pagado (${brandName})`, '$19.99+', '5-10 minutos', '⭐⭐⭐⭐⭐'],
              ['Fotógrafo profesional', '$200-500', '2-4 horas', '⭐⭐⭐⭐⭐']
            ]
          },
          p2: 'Giro: "gratis" a menudo cuesta más en tiempo. Si tu tiempo vale $30/hora, gastar 3 horas en herramientas gratuitas equivale a $90 - más que la mayoría de las opciones pagadas.'
        }
      },
      faqTitle: 'Preguntas Frecuentes',
      cta: {
        title: '¿Listo para resultados profesionales?',
        description: `Actualiza de herramientas gratuitas a ${brandName} para headshots AI de calidad de estudio en 60 segundos.`,
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
    title: 'Best Free AI Headshot Generator 2025: Realistic Results Without Paying',
    description: `Discover the best free AI headshot generator for 2025. Create professional ai headshots from selfies without watermarks or limits. Compare top free tools.`,
    breadcrumb: 'Free AI Headshot Generator',
    tldr: [
      '<strong>Top free pick:</strong> BetterPic - Quick, realistic free AI headshots without watermarks.',
      '<strong>Limitations:</strong> Free tools often have low resolution and basic styles. For pro use, paid is better.',
      '<strong>When to upgrade:</strong> If you need high-res, commercial rights, or team consistency.'
    ],
    sections: {
      whyUse: {
        title: 'Why Use a Free AI Headshot Generator in 2025?',
        p1: 'Free AI headshot generators have come a long way in 2025. With improved realism and no-cost access, they\'re perfect for testing the waters or casual use. Based on our research, adoption is up 65% among job seekers for quick profile updates.',
        p2: 'The appeal is obvious: who doesn\'t want professional-looking photos without spending money? But here\'s what you need to know before diving in.'
      },
      topGenerators: {
        title: 'Top Free AI Headshot Generators 2025',
        table: {
          headers: ['Tool', 'Best For', 'Speed', 'Quality', 'Watermarks'],
          rows: [
            ['BetterPic', 'Quick realistic shots', 'Minutes', '⭐⭐⭐⭐', 'No'],
            ['Fotor AI', 'Basic editing', 'Seconds', '⭐⭐⭐', 'Sometimes'],
            ['ImagineArt', 'Creative styles', 'Minutes', '⭐⭐⭐⭐', 'No'],
            ['Vheer', 'Basic headshots', 'Minutes', '⭐⭐⭐', 'Sometimes']
          ]
        }
      },
      whatTheyDoWell: {
        title: 'What Free AI Headshot Generators Do Well',
        p1: 'Free tools have their place. Here\'s when they make sense:',
        boxTitle: '✅ Good Use Cases for Free Tools',
        items: [
          '• Testing AI headshots before committing to paid',
          '• Gaming avatars or Discord profile pictures',
          '• Personal social media accounts where professional perception doesn\'t matter',
          '• Temporary placeholder while you get proper photos',
          '• Fun experiments or trying different looks'
        ]
      },
      hiddenCosts: {
        title: 'The Hidden Costs of "Free"',
        p1: 'Free doesn\'t always mean free. Here\'s what you might be giving up:',
        boxTitle: '⚠️ Common Limitations',
        items: [
          '📉 <strong>Low resolution:</strong> 512x512 or 1024x1024 max - fine for thumbnails, not for printing',
          '🎨 <strong>Limited styles:</strong> 2-5 basic backgrounds vs. unlimited options in paid',
          '⏰ <strong>Slow processing:</strong> Some free tools take 30+ minutes vs. 60 seconds for paid',
          '🚫 <strong>No commercial rights:</strong> Can\'t use for business purposes without upgrading',
          '📊 <strong>Your data:</strong> Free tools often train models on your photos'
        ]
      },
      whenNotEnough: {
        title: 'When Free Isn\'t Enough (And Why Upgrade to Paid)',
        p1: `Free tools are great starters, but for LinkedIn or professional use, paid options like ${brandName} offer better realism and no limits.`,
        items: [
          { title: 'LinkedIn Profile', text: 'Profiles with professional photos get 21x more views. Free tools often look obviously artificial, hurting credibility.' },
          { title: 'Company Website', text: 'When clients visit your site, low-quality headshots signal "we cut corners." Paid tools deliver studio-quality results.' },
          { title: 'Team Consistency', text: 'Free tools can\'t deliver matching styles across team members. For corporate use, consistency matters.' },
          { title: 'Commercial Use', text: 'Need photos for proposals, pitch decks, or marketing? Free tools often restrict commercial rights.' }
        ]
      },
      roi: {
        title: 'The ROI Math: Free vs Paid',
        p1: 'Let\'s be honest about the real cost:',
        table: {
          headers: ['Option', 'Direct Cost', 'Time Cost', 'Quality'],
          rows: [
            ['Free AI tools', '$0', '2-3 hours (trial & error)', '⭐⭐⭐'],
            [`Paid AI (${brandName})`, '$19.99+', '5-10 minutes', '⭐⭐⭐⭐⭐'],
            ['Professional photographer', '$200-500', '2-4 hours', '⭐⭐⭐⭐⭐']
          ]
        },
        p2: 'Plot twist: "free" often costs more in time. If your time is worth $30/hour, spending 3 hours on free tools equals $90 - more than most paid options.'
      }
    },
    faqTitle: 'Frequently Asked Questions',
    cta: {
      title: 'Ready for professional results?',
      description: `Upgrade from free tools to ${brandName} for studio-quality AI headshots in 60 seconds.`,
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
        question: '¿Hay generadores de headshots AI verdaderamente gratuitos?',
        answer: 'Sí, herramientas como BetterPic ofrecen headshots gratuitos sin marcas de agua. Sin embargo, a menudo tienen limitaciones en resolución, estilos y descargas diarias comparado con sus versiones pagadas.',
      },
      {
        question: '¿Por qué las herramientas gratuitas tienen marcas de agua?',
        answer: 'Las herramientas gratuitas usan marcas de agua para animar a los usuarios a actualizar a planes pagados. Cuesta dinero ejecutar los servidores de IA, por lo que necesitan monetizar de alguna manera. Buscar "sin marca de agua" a menudo lleva a opciones de menor calidad.',
      },
      {
        question: '¿Son seguras las herramientas de headshots AI gratuitas?',
        answer: 'La mayoría son seguras, pero siempre revisa su política de privacidad. Algunas herramientas gratuitas pueden usar tus fotos cargadas para entrenar sus modelos públicos. Los servicios pagados como TeamShots típicamente tienen protecciones de privacidad más estrictas.',
      },
      {
        question: '¿Puedo usar headshots AI gratuitos comercialmente?',
        answer: 'Depende de los términos de servicio de la herramienta. Muchos generadores gratuitos restringen el uso comercial, lo que significa que no puedes usarlos en sitios web de empresas o materiales de marketing. Siempre verifica la licencia.',
      },
      {
        question: '¿Cuál es el mejor generador de headshots AI gratuito para LinkedIn?',
        answer: 'Recomendamos BetterPic por su equilibrio entre calidad y velocidad. Sin embargo, para obtener los mejores resultados profesionales en LinkedIn, una herramienta pagada a menudo vale la pequeña inversión para evitar ese aspecto "obviamente AI".',
      },
    ];
  }

  // English
  return [
    {
      question: 'Are there truly free AI headshot generators?',
      answer: 'Yes, tools like BetterPic offer free headshots without watermarks. However, they often have limitations on resolution, styles, and daily downloads compared to their paid versions.',
    },
    {
      question: 'Why do free tools have watermarks?',
      answer: 'Free tools use watermarks to encourage users to upgrade to paid plans. It costs money to run the AI servers, so they need to monetize somehow. Looking for "no watermark" often leads to lower quality options.',
    },
    {
      question: 'Are free AI headshot tools safe?',
      answer: 'Most are safe, but always check their privacy policy. Some free tools might use your uploaded photos to train their public models. Paid services like TeamShots typically have stricter privacy protections.',
    },
    {
      question: 'Can I use free AI headshots commercially?',
      answer: 'It depends on the tool\'s terms of service. Many free generators restrict commercial use, meaning you can\'t use them on company websites or marketing materials. Always check the license.',
    },
    {
      question: 'What is the best free AI headshot generator for LinkedIn?',
      answer: 'We recommend BetterPic for its balance of quality and speed. However, for the best professional results on LinkedIn, a paid tool is often worth the small investment to avoid that "obviously AI" look.',
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
      canonical: '/blog/free-ai-headshot-generator',
      languages: {
        en: '/blog/free-ai-headshot-generator',
        es: '/es/blog/free-ai-headshot-generator',
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function FreeAIHeadshotGeneratorPage({ params }: Props) {
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
        url={`${baseUrl}${locale === 'es' ? '/es' : ''}/blog/free-ai-headshot-generator`}
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
          {content.sections.whyUse.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whyUse.p1}
        </p>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whyUse.p2}
        </p>

        {/* Top Generators Table */}
        <h2 className="text-2xl font-bold mt-12 mb-6 text-gray-900">
          {content.sections.topGenerators.title}
        </h2>

        <div className="overflow-x-auto mb-10">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.topGenerators.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.topGenerators.table.rows.map((row, i) => (
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
          {content.sections.whatTheyDoWell.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whatTheyDoWell.p1}
        </p>

        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-green-900 mb-3">{content.sections.whatTheyDoWell.boxTitle}</h3>
          <ul className="space-y-2 text-green-800">
            {content.sections.whatTheyDoWell.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.hiddenCosts.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.hiddenCosts.p1}
        </p>

        <div className="bg-amber-50 p-6 rounded-lg mb-6">
          <h3 className="font-semibold text-amber-900 mb-3">{content.sections.hiddenCosts.boxTitle}</h3>
          <ul className="space-y-2 text-amber-800">
            {content.sections.hiddenCosts.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2" dangerouslySetInnerHTML={{ __html: item.replace('📉', '<span class="text-amber-600 font-bold">📉</span><span>').replace('🎨', '<span class="text-amber-600 font-bold">🎨</span><span>').replace('⏰', '<span class="text-amber-600 font-bold">⏰</span><span>').replace('🚫', '<span class="text-amber-600 font-bold">🚫</span><span>').replace('📊', '<span class="text-amber-600 font-bold">📊</span><span>').replace(':', '</strong>') + '</span>' }} />
            ))}
          </ul>
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.whenNotEnough.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.whenNotEnough.p1}
        </p>

        <div className="space-y-4 mb-6">
          {content.sections.whenNotEnough.items.map((item, i) => (
            <div key={i} className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4 text-gray-900">
          {content.sections.roi.title}
        </h2>

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.roi.p1}
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {content.sections.roi.table.headers.map((header, i) => (
                  <th key={i} className="border border-gray-200 p-3 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.sections.roi.table.rows.map((row, i) => (
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

        <p className="mb-4 text-gray-700 leading-relaxed">
          {content.sections.roi.p2}
        </p>

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
